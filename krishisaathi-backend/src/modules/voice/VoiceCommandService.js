const { getOpenAiClient, getOpenAiModel } = require('../../lib/openai_client');
const { assertRateLimit } = require('../../utils/rate_limit');
const { detectMessageLanguage } = require('../../utils/detect_message_language');
const ApiError = require('../../utils/ApiError');
const FarmService = require('../farms/FarmService');
const AssistantService = require('../assistant/AssistantService');
const {
  DEFAULT_SUGGESTIONS,
  missingSlots,
  slotQuestion,
  unknownPrompt,
  helpText,
  assistantErrorText,
} = require('./voice_slots');
const { matchTargetFromSpeech } = require('./target_matcher');

const RECORD_INTENTS = ['expense', 'income', 'reminder'];
const ALL_INTENTS = [...RECORD_INTENTS, 'assistant', 'help', 'unknown'];
const EXPENSE_CATEGORIES = [
  'seed', 'fertilizer', 'pesticide', 'irrigation', 'labor', 'equipment', 'transport', 'other',
];
const INCOME_CATEGORIES = ['harvest', 'sale', 'subsidy', 'other'];
const REMINDER_TYPES = ['irrigation', 'fertilizer', 'pesticide', 'harvest', 'weather', 'custom'];
const MAX_TARGETS_IN_PROMPT = 25;

/**
 * The farmer's voice companion. It logs money and reminders by collecting the needed
 * slots over a short back-and-forth, answers farming questions through the Farm
 * Assistant, and — when it cannot tell what was meant — offers clear options instead
 * of dead-ending.
 */
class VoiceCommandService {
  async interpret(user_id, { transcript, language, draft = {}, intent = null }) {
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
    const parsed = await this.#askModel(spoken, { draft, intent, targets, reply_language });
    const next_intent = this.#resolveIntent(parsed.intent, intent);

    if (next_intent === 'assistant') {
      return this.#assistantTurn(user_id, spoken, reply_language);
    }

    if (next_intent === 'help' || next_intent === 'unknown') {
      return this.#optionsTurn(next_intent, spoken, reply_language);
    }

    return this.#recordTurn(next_intent, parsed, { spoken, draft, targets, reply_language });
  }

  /**
   * While a record is being filled, short answers ("labour", "haan") must keep that
   * record's intent — only a fresh utterance may switch to a question or another record.
   */
  #resolveIntent(parsed_intent, active_intent) {
    const is_valid = ALL_INTENTS.includes(parsed_intent);
    const is_filling_record = RECORD_INTENTS.includes(active_intent);

    if (is_filling_record) {
      return RECORD_INTENTS.includes(parsed_intent) ? parsed_intent : active_intent;
    }

    return is_valid ? parsed_intent : 'unknown';
  }

  #recordTurn(intent, parsed, { spoken, draft, targets, reply_language }) {
    const next_draft = this.#mergeDraft(intent, draft, parsed.fields, targets, spoken);
    const missing = missingSlots(intent, next_draft);

    return {
      ...this.#baseTurn(intent, reply_language, spoken),
      draft: next_draft,
      missing,
      is_ready: missing.length === 0,
      // Fixed wording per slot: the model sometimes drifts into asking for details we
      // do not need, which strands the farmer in an endless conversation.
      question: missing.length ? slotQuestion(intent, missing[0], reply_language) : null,
      summary: missing.length ? null : (parsed.summary || null),
    };
  }

  /** Hands the utterance to the Farm Assistant so voice can answer questions, not just log. */
  async #assistantTurn(user_id, spoken, reply_language) {
    try {
      const result = await AssistantService.chat(user_id, spoken);

      return {
        ...this.#baseTurn('assistant', reply_language, spoken),
        answer: result?.message?.content || assistantErrorText(reply_language),
        suggestions: RECORD_INTENTS,
        can_continue: true,
      };
    } catch (error) {
      const is_rate_limited = error?.status_code === 429;

      return {
        ...this.#baseTurn('assistant', reply_language, spoken),
        answer: assistantErrorText(reply_language, is_rate_limited),
        suggestions: DEFAULT_SUGGESTIONS,
        can_continue: !is_rate_limited,
      };
    }
  }

  /** "What can I do?" and anything unclear both land here with tappable next steps. */
  #optionsTurn(intent, spoken, reply_language) {
    const answer = intent === 'help' ? helpText(reply_language) : unknownPrompt(reply_language);

    return {
      ...this.#baseTurn(intent, reply_language, spoken),
      answer,
      suggestions: DEFAULT_SUGGESTIONS,
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

  #mergeDraft(intent, draft, fields = {}, targets = [], spoken = '') {
    const merged = { ...draft };
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

  async #askModel(spoken, { draft, intent, targets, reply_language }) {
    const openai = getOpenAiClient();
    let completion;

    try {
      completion = await openai.chat.completions.create({
        model: getOpenAiModel(),
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          { role: 'system', content: this.#systemPrompt({ draft, intent, targets, reply_language }) },
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

  #systemPrompt({ draft, intent, targets, reply_language }) {
    const language_name = reply_language === 'hi' ? 'Hindi (Devanagari script)' : 'English';

    return [
      'You are an Indian farmer\'s voice companion. First decide what the farmer wants, then,',
      'only for money/reminder records, extract the structured fields.',
      'Speech may be Hindi, English or Hinglish, and is often a short answer to a question you just asked.',
      '',
      'Return JSON only, with this shape:',
      '{"intent":"expense|income|reminder|assistant|help|unknown","fields":{"title":string|null,',
      '"category":string|null,"amount":number|null,"quantity":number|null,"unit":string|null,',
      '"date":"YYYY-MM-DD"|null,"due_at":"YYYY-MM-DD"|null,"reminder_type":string|null,',
      '"target_key":string|null,"notes":string|null},"summary":string|null,"confidence":number}',
      '',
      'Choosing intent:',
      '- "expense": money spent on farming. "income": money earned/crop sold.',
      '- "reminder": the farmer wants to be reminded to do a task later.',
      '- "assistant": any farming question, advice, or a wish to talk to the assistant — crop disease,',
      '  weather, prices, schemes, "मेरी फसल पीली पड़ रही है", "सलाह चाहिए", "farm assistant से बात करनी है".',
      '- "help": the farmer asks what this app or voice can do, e.g. "इससे क्या कर सकता हूँ", "what can I do".',
      '- "unknown": only when the speech is truly unintelligible or empty of meaning.',
      '- A short word like a farm/crop name, a bare number, or "haan/नहीं" is an answer to your last',
      '  question, not a new question — keep the record intent in that case.',
      '',
      'Field rules (only when intent is expense, income or reminder):',
      '- Only fill a field the farmer actually mentioned; use null otherwise. Never invent an amount.',
      `- Merge with the draft already collected: ${JSON.stringify(draft || {})}.`,
      intent ? `- The farmer is currently completing a "${intent}" record; keep that intent unless they clearly switch.` : '',
      `- "title" is what the money was for ("urea", "खाद", "labour") or the reminder task.`,
      `- expense categories: ${EXPENSE_CATEGORIES.join(', ')}. income categories: ${INCOME_CATEGORIES.join(', ')}.`,
      `- reminder_type: ${REMINDER_TYPES.join(', ')}.`,
      '- Map urea/DAP/NPK/खाद to fertilizer, spray/कीटनाशक to pesticide, बीज to seed, मजदूर/labour to labor,',
      '  diesel/भाड़ा to transport, pump/pipe to equipment. Selling crop is income with category "sale".',
      `- Today is ${this.#todayWithWeekday()} (India). Resolve "आज", "कल", "परसों", "yesterday",`,
      '  "सोमवार", "next Monday" to real dates. A named weekday means the next such day from today.',
      '- Amounts are Indian rupees; understand Hindi number words ("पाँच सौ" = 500, "दो हज़ार" = 2000).',
      '- Keep the unit the farmer said (quintal, kg, bag, litre, bora). Never convert between units.',
      '- Pick target_key when the farmer names a farm, plot or crop from this list. Hindi crop words map',
      '  to English names: आलू=Potato, गेहूँ=Wheat, धान/चावल=Rice, प्याज=Onion, टमाटर=Tomato,',
      '  सरसों=Mustard, गन्ना=Sugarcane, कपास=Cotton, मक्का=Maize, चना=Chana, मूँग=Moong.',
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
