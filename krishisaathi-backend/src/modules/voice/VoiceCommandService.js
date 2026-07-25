const { getOpenAiClient, getOpenAiModel } = require('../../lib/openai_client');
const { assertRateLimit } = require('../../utils/rate_limit');
const { detectMessageLanguage } = require('../../utils/detect_message_language');
const ApiError = require('../../utils/ApiError');
const FarmService = require('../farms/FarmService');
const AssistantService = require('../assistant/AssistantService');
const {
  suggestionsForContext,
  missingSlots,
  slotQuestion,
  unknownPrompt,
  helpText,
  assistantErrorText,
} = require('./voice_slots');
const { matchTargetFromSpeech } = require('./target_matcher');
const { summarizeMoney, formatMoneyAnswer } = require('./money_query');
const { sanitizeStructureName, parseSpokenArea } = require('./structure_parse');

const RECORD_INTENTS = ['expense', 'income', 'reminder'];
const STRUCTURE_INTENTS = ['create_farm', 'create_plot'];
const FILLING_INTENTS = [...RECORD_INTENTS, ...STRUCTURE_INTENTS];
const ALL_INTENTS = [...FILLING_INTENTS, 'assistant', 'money_query', 'help', 'unknown'];
const EXPENSE_CATEGORIES = [
  'seed', 'fertilizer', 'pesticide', 'irrigation', 'labor', 'equipment', 'transport', 'other',
];
const INCOME_CATEGORIES = ['harvest', 'sale', 'subsidy', 'other'];
const REMINDER_TYPES = ['irrigation', 'fertilizer', 'pesticide', 'harvest', 'weather', 'custom'];
const MAX_TARGETS_IN_PROMPT = 25;

/**
 * The farmer's voice companion. It logs money and reminders, creates farms/plots,
 * answers farming questions, and offers clear options when speech is unclear.
 */
class VoiceCommandService {
  async interpret(user_id, { transcript, language, draft = {}, intent = null, context = {} }) {
    const spoken = String(transcript || '').trim();

    if (!spoken) {
      throw ApiError.badRequest('Transcript is required');
    }

    await assertRateLimit({
      key: `voice_command:${user_id}`,
      limit: 90,
      window_seconds: 3600,
      message: 'Voice limit reached. Try again in an hour.',
    });

    const reply_language = this.#replyLanguage(language, spoken);
    const targets = await FarmService.getQuickLogTargets(user_id);
    const seeded_draft = this.#seedDraftFromContext(draft, context, targets);
    const parsed = await this.#askModel(spoken, {
      draft: seeded_draft,
      intent,
      targets,
      reply_language,
      context,
    });
    const next_intent = this.#resolveIntent(parsed.intent, intent);

    if (next_intent === 'assistant') {
      return this.#assistantTurn(user_id, spoken, reply_language, context);
    }

    if (next_intent === 'money_query') {
      return this.#moneyQueryTurn(user_id, spoken, parsed, reply_language, context);
    }

    if (next_intent === 'help' || next_intent === 'unknown') {
      return this.#optionsTurn(next_intent, spoken, reply_language, context);
    }

    return this.#recordTurn(next_intent, parsed, {
      spoken,
      draft: seeded_draft,
      targets,
      reply_language,
      context,
    });
  }

  /**
   * While a record is being filled, short answers ("labour", "haan") must keep that
   * record's intent — only a fresh utterance may switch to a question or another record.
   */
  #resolveIntent(parsed_intent, active_intent) {
    const is_valid = ALL_INTENTS.includes(parsed_intent);
    const is_filling = FILLING_INTENTS.includes(active_intent);

    if (is_filling) {
      return FILLING_INTENTS.includes(parsed_intent) ? parsed_intent : active_intent;
    }

    return is_valid ? parsed_intent : 'unknown';
  }

  #recordTurn(intent, parsed, { spoken, draft, targets, reply_language, context }) {
    const next_draft = this.#mergeDraft(intent, draft, parsed.fields, targets, spoken, context);
    const missing = missingSlots(intent, next_draft);

    return {
      ...this.#baseTurn(intent, reply_language, spoken),
      draft: next_draft,
      missing,
      is_ready: missing.length === 0,
      question: missing.length ? slotQuestion(intent, missing[0], reply_language) : null,
      summary: missing.length ? null : (parsed.summary || null),
    };
  }

  async #assistantTurn(user_id, spoken, reply_language, context) {
    try {
      const result = await AssistantService.chat(user_id, spoken, {
        farm_id: context.farm_id || undefined,
        plot_id: context.plot_id || undefined,
      });

      return {
        ...this.#baseTurn('assistant', reply_language, spoken),
        answer: result?.message?.content || assistantErrorText(reply_language),
        suggestions: suggestionsForContext(context).filter((key) => key !== 'assistant'),
        can_continue: true,
      };
    } catch (error) {
      const is_rate_limited = error?.status_code === 429;

      return {
        ...this.#baseTurn('assistant', reply_language, spoken),
        answer: assistantErrorText(reply_language, is_rate_limited),
        suggestions: suggestionsForContext(context),
        can_continue: !is_rate_limited,
      };
    }
  }

  async #moneyQueryTurn(user_id, spoken, parsed, reply_language, context) {
    const fields = parsed.fields || {};
    const filters = {
      kind: fields.kind === 'income' ? 'income' : 'expense',
      category: this.#toCategory('expense', fields.category),
      query: this.#toText(fields.query || fields.title, 80),
      from: this.#toDate(fields.date_from || fields.from || fields.date),
      to: this.#toDate(fields.date_to || fields.to) || this.#monthEnd(fields.date_from || fields.from || fields.date),
      farm_id: context.farm_id || null,
    };

    // A bare month like July often arrives as date_from=2026-07-01 without to.
    if (filters.from && !this.#toDate(fields.date_to || fields.to)) {
      filters.to = this.#monthEnd(filters.from);
    }

    try {
      const summary = await summarizeMoney(user_id, filters);
      return {
        ...this.#baseTurn('money_query', reply_language, spoken),
        answer: formatMoneyAnswer(summary, reply_language),
        suggestions: suggestionsForContext({ ...context, page: context.page || 'money' }),
        can_continue: true,
      };
    } catch (error) {
      console.error('[voice_command] money query failed:', error.message);
      return {
        ...this.#baseTurn('money_query', reply_language, spoken),
        answer: reply_language === 'hi'
          ? 'अभी खर्च का हिसाब नहीं निकाल पाया। थोड़ी देर बाद कोशिश करें।'
          : 'I could not calculate that right now. Please try again shortly.',
        suggestions: suggestionsForContext(context),
      };
    }
  }

  #monthEnd(value) {
    const date = this.#toDate(value);
    if (!date) {
      return null;
    }

    const [year, month] = date.split('-').map(Number);
    const last = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  #optionsTurn(intent, spoken, reply_language, context) {
    const answer = intent === 'help' ? helpText(reply_language) : unknownPrompt(reply_language);

    return {
      ...this.#baseTurn(intent, reply_language, spoken),
      answer,
      suggestions: suggestionsForContext(context),
    };
  }

  #baseTurn(intent, reply_language, spoken) {
    return {
      intent,
      draft: {},
      missing: [],
      is_ready: false,
      question: null,
      summary: null,
      answer: null,
      suggestions: null,
      can_continue: false,
      language: reply_language,
      transcript: spoken,
    };
  }

  /** Prefill farm/plot ids when the farmer opened the mic on that screen. */
  #seedDraftFromContext(draft = {}, context = {}, targets = []) {
    const seeded = { ...draft };

    if (context.farm_id && !seeded.farm_id) {
      const farm = targets.find((target) => target.farm_id === context.farm_id);
      if (farm || context.page === 'farm' || context.page === 'plot') {
        seeded.farm_id = context.farm_id;
      }
    }

    if (context.plot_id && !seeded.plot_id) {
      seeded.plot_id = context.plot_id;
    }

    return seeded;
  }

  #mergeDraft(intent, draft, fields = {}, targets = [], spoken = '', context = {}) {
    const merged = { ...draft };

    if (STRUCTURE_INTENTS.includes(intent)) {
      return this.#mergeStructureDraft(intent, merged, fields, targets, spoken, context);
    }

    const amount = this.#toNumber(fields.amount);
    const quantity = this.#toNumber(fields.quantity);

    this.#assign(merged, 'title', this.#toText(fields.title, 150));
    this.#assign(merged, 'notes', this.#toText(fields.notes, 500));
    this.#assign(merged, 'unit', this.#toText(fields.unit, 40));
    this.#assign(merged, 'amount', amount);
    this.#assign(merged, 'quantity', quantity);
    this.#assign(merged, 'category', this.#toCategory(intent, fields.category));
    this.#assign(merged, 'reminder_type', REMINDER_TYPES.includes(fields.reminder_type)
      ? fields.reminder_type
      : null);
    this.#assign(
      merged,
      'target_key',
      this.#resolveTargetKey(fields.target_key, targets) || matchTargetFromSpeech(spoken, targets),
    );

    this.#applyDates(intent, merged, fields);

    if (!merged.target_key) {
      merged.target_key = this.#defaultTargetKey(targets);
    }

    return merged;
  }

  #mergeStructureDraft(intent, draft, fields, targets, spoken, context) {
    const merged = { ...draft };
    const raw_name = this.#toText(fields.name, 150) || this.#toText(fields.title, 150);
    const name = sanitizeStructureName(raw_name);
    const spoken_area = parseSpokenArea(spoken);
    const model_area = this.#toNumber(fields.total_area) || this.#toNumber(fields.area);

    // Only set name when it is a real place name — never "नया खेत" / "add farm".
    this.#assign(merged, 'name', name);
    this.#assign(merged, 'state', this.#toText(fields.state, 100));
    this.#assign(merged, 'district', this.#toText(fields.district, 100));
    this.#assign(merged, 'village', this.#toText(fields.village, 150));
    this.#assign(merged, 'notes', this.#toText(fields.notes, 500));
    // Prefer the number heard in speech ("4 bigha") over a model guess/conversion.
    this.#assign(merged, 'total_area', spoken_area || model_area);
    this.#assign(merged, 'area', spoken_area || model_area);
    this.#assign(merged, 'soil_type', this.#toText(fields.soil_type, 80));

    if (intent === 'create_plot') {
      const farm_id = this.#resolveFarmId(fields.farm_id || fields.target_key, targets, spoken, context);
      this.#assign(merged, 'farm_id', farm_id);
      if (!merged.farm_id && targets.filter((row) => row.target_type === 'farm').length === 1) {
        merged.farm_id = targets.find((row) => row.target_type === 'farm').farm_id;
      }
    }

    return merged;
  }

  #resolveFarmId(value, targets, spoken, context) {
    if (context.farm_id) {
      return context.farm_id;
    }

    const raw = String(value || '').trim();
    if (raw.startsWith('farm:')) {
      const farm_id = raw.slice(5);
      return targets.some((target) => target.farm_id === farm_id) ? farm_id : null;
    }

    if (targets.some((target) => target.farm_id === raw)) {
      return raw;
    }

    const matched = matchTargetFromSpeech(spoken, targets.filter((row) => row.target_type === 'farm'));
    return matched ? matched.replace(/^farm:/, '') : null;
  }

  /** A reminder only has a due date, so any date the farmer gives is the due date. */
  #applyDates(intent, draft, fields) {
    const spoken_date = this.#toDate(fields.due_at) || this.#toDate(fields.date);

    if (intent === 'reminder') {
      this.#assign(draft, 'due_at', spoken_date);
      delete draft.date;
      return;
    }

    this.#assign(draft, 'date', spoken_date);
    draft.date = draft.date || this.#today();
  }

  #assign(draft, field, value) {
    if (value !== null && value !== undefined) {
      draft[field] = value;
    }
  }

  #resolveTargetKey(target_key, targets) {
    const key = String(target_key || '').trim();
    return targets.some((target) => target.target_key === key) ? key : null;
  }

  #defaultTargetKey(targets) {
    const preferred = targets.find((target) => target.target_type === 'crop') || targets[0];
    return preferred?.target_key || null;
  }

  async #askModel(spoken, { draft, intent, targets, reply_language, context }) {
    const openai = getOpenAiClient();
    let completion;

    try {
      completion = await openai.chat.completions.create({
        model: getOpenAiModel(),
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: this.#systemPrompt({ draft, intent, targets, reply_language, context }),
          },
          { role: 'user', content: spoken },
        ],
      });
    } catch (error) {
      console.error('[voice_command] OpenAI error:', error.message);
      throw ApiError.serviceUnavailable('Voice service is busy. Please try again shortly.');
    }

    try {
      return JSON.parse(completion.choices?.[0]?.message?.content || '{}');
    } catch (error) {
      return { intent: 'unknown', fields: {} };
    }
  }

  #systemPrompt({ draft, intent, targets, reply_language, context }) {
    const language_name = reply_language === 'hi' ? 'Hindi (Devanagari script)' : 'English';
    const page = context?.page || 'home';

    return [
      'You are an Indian farmer\'s voice companion. First decide what the farmer wants, then',
      'extract structured fields for that intent.',
      'Speech may be Hindi, English or Hinglish, and is often a short answer to a question you just asked.',
      '',
      'Return JSON only, with this shape:',
      '{"intent":"expense|income|reminder|create_farm|create_plot|money_query|assistant|help|unknown",',
      '"fields":{"title":string|null,"name":string|null,"category":string|null,"amount":number|null,',
      '"quantity":number|null,"unit":string|null,"date":"YYYY-MM-DD"|null,"due_at":"YYYY-MM-DD"|null,',
      '"date_from":"YYYY-MM-DD"|null,"date_to":"YYYY-MM-DD"|null,"query":string|null,"kind":"expense|income"|null,',
      '"reminder_type":string|null,"target_key":string|null,"notes":string|null,"state":string|null,',
      '"district":string|null,"village":string|null,"total_area":number|null,"area":number|null,',
      '"soil_type":string|null,"farm_id":string|null},"summary":string|null,"confidence":number}',
      '',
      'Choosing intent:',
      '- "expense": money spent on farming. "income": money earned/crop sold.',
      '- "reminder": the farmer wants to be reminded to do a task later.',
      '- "create_farm": add a new farm/field. Phrases like "नया खेत जोड़ो", "naya khet jodo",',
      '  "add a new farm" are ONLY the intent — never put them in "name". Leave name null and ask.',
      '- "create_plot": add a plot inside a farm, e.g. "नया प्लॉट जोड़ो", "add plot of 2 acre".',
      '- "money_query": questions about past spending or earning, e.g. "जुलाई में कितना खर्च",',
      '  "how much on diesel", "डीजल पर कुल कितना खर्च", "this season income". Do NOT use assistant for these.',
      '- "assistant": farming advice questions (crop disease, weather, schemes) — not money totals.',
      '- "help": the farmer asks what this app or voice can do.',
      '- "unknown": only when the speech is truly unintelligible or empty of meaning.',
      `- The farmer is currently on the "${page}" screen`
        + (context?.farm_id ? ` (farm ${context.farm_id})` : '')
        + (context?.plot_id ? ` (plot ${context.plot_id})` : '')
        + '. Prefer create_farm on farms screens, create_plot on a farm detail screen,',
      '  money_query on the money screen, and assistant on the assistant screen — but always honour a clear spoken intent.',
      '- A short word like a farm/crop name, a bare number, or "haan/नहीं" is an answer to your last',
      '  question, not a new question — keep the active intent in that case.',
      '',
      'Field rules:',
      '- Only fill a field the farmer actually mentioned; use null otherwise. Never invent amounts.',
      `- Merge with the draft already collected: ${JSON.stringify(draft || {})}.`,
      intent ? `- The farmer is currently completing a "${intent}" action; keep that intent unless they clearly switch.` : '',
      `- For expense/income/reminder, "title" is what the money was for or the reminder task.`,
      `- For create_farm/create_plot, put a real farm/plot name in "name" (village or family name).`,
      '  Never use "नया खेत", "naya khet", "new farm", or "add farm" as the name.',
      '- For money_query: set kind expense|income, query to the item word (diesel/डीजल/urea),',
      '  category when clear, and date_from/date_to for months ("July" → first/last day of that month).',
      '  If only a month is named, set date_from to the 1st and date_to to the last day.',
      `- expense categories: ${EXPENSE_CATEGORIES.join(', ')}. income categories: ${INCOME_CATEGORIES.join(', ')}.`,
      `- reminder_type: ${REMINDER_TYPES.join(', ')}.`,
      '- Map urea/DAP/NPK/खाद to fertilizer, spray/कीटनाशक to pesticide, बीज to seed, मजदूर/labour to labor,',
      '  diesel/डीजल/भाड़ा to transport, pump/pipe to equipment. Selling crop is income with category "sale".',
      `- For create_farm, always collect total_area. "चार बीघा" / "4 bigha" → total_area: 4.`,
      '  Keep the number the farmer said. Never convert bigha↔acre↔hectare.',
      `- Today is ${this.#todayWithWeekday()} (India). Resolve "आज", "कल", "परसों", "yesterday",`,
      '  "सोमवार", "next Monday", "July", "जुलाई" to real dates. A named weekday means the next such day from today.',
      '- Amounts are Indian rupees; understand Hindi number words ("पाँच सौ" = 500, "दो हज़ार" = 2000).',
      '- Keep the unit the farmer said (quintal, kg, bag, litre, bora). Never convert between units.',
      '- Area numbers: "दो एकड़" = 2, "चार बीघा" = 4. Do not convert land units.',
      '- Pick target_key / farm_id when the farmer names a farm, plot or crop from this list.',
      this.#targetLines(targets),
      `- "summary": when nothing is missing, read back what will be saved in one short line in ${language_name}.`,
      '  The summary is shown before saving, so never say it is already saved or done.',
    ].filter(Boolean).join('\n');
  }

  #targetLines(targets) {
    if (!targets.length) {
      return '  (no farms yet)';
    }

    return targets
      .slice(0, MAX_TARGETS_IN_PROMPT)
      .map((target) => `  ${target.target_key} = ${[target.farm_name, target.plot_name, target.crop_name]
        .filter(Boolean)
        .join(' / ')}`)
      .join('\n');
  }

  #replyLanguage(language, spoken) {
    if (language === 'hi' || language === 'en') {
      return language;
    }

    return detectMessageLanguage(spoken) === 'hi' ? 'hi' : 'en';
  }

  #toNumber(value) {
    const number = Number(value);
    return value != null && !Number.isNaN(number) && number > 0 ? number : null;
  }

  #toText(value, max_length) {
    const text = String(value ?? '').trim();
    return text ? text.slice(0, max_length) : null;
  }

  #toCategory(intent, value) {
    const list = intent === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return list.includes(value) ? value : null;
  }

  #toDate(value) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  #today() {
    return new Date().toISOString().slice(0, 10);
  }

  #todayWithWeekday() {
    const weekday = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      timeZone: 'Asia/Kolkata',
    });

    return `${weekday} ${this.#today()}`;
  }
}

module.exports = new VoiceCommandService();
