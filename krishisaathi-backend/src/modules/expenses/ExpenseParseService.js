const db = require('../../db/connection');
const { getOpenAiClient, getOpenAiModel } = require('../../lib/openai_client');
const { assertRateLimit } = require('../../utils/rate_limit');
const ApiError = require('../../utils/ApiError');

const EXPENSE_CATEGORIES = [
  'seed',
  'fertilizer',
  'pesticide',
  'irrigation',
  'labor',
  'equipment',
  'transport',
  'other',
];

class ExpenseParseService {
  async parseTranscript(user_id, farm_id, { transcript, plot_id = null, crop_cycle_id = null }) {
    const farm = await db('farms').where({ id: farm_id, user_id, is_active: true }).first();

    if (!farm) {
      throw ApiError.notFound('Farm not found');
    }
    await assertRateLimit({
      key: `expense_parse:${user_id}`,
      limit: 30,
      window_seconds: 3600,
      message: 'Voice parse limit reached. Try again in an hour.',
    });

    const trimmed = String(transcript || '').trim();

    if (!trimmed) {
      throw ApiError.badRequest('Transcript is required');
    }

    const openai = getOpenAiClient();
    const today = new Date().toISOString().slice(0, 10);

    let completion;

    try {
      completion = await openai.chat.completions.create({
        model: getOpenAiModel(),
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: [
              'Extract a farm expense from the farmer speech transcript (English, Hindi, or Hinglish).',
              'Return JSON only with keys:',
              'title (string), category (one of: seed,fertilizer,pesticide,irrigation,labor,equipment,transport,other),',
              'quantity (number|null), unit (string|null), amount (number|null), expense_date (YYYY-MM-DD),',
              'notes (string|null), confidence (0-1 number).',
              `Today is ${today}. If date missing, use today.`,
              'Map urea/DAP/NPK/खाद to fertilizer; spray/कीटनाशक to pesticide; seed/बीज to seed;',
              'labour/मजदूर to labor; diesel/petrol transport to transport; pipe/pump equipment to equipment.',
              'Amount is in Indian rupees. Parse "3200" or "तीन हजार दो सौ" as 3200.',
            ].join(' '),
          },
          { role: 'user', content: trimmed },
        ],
      });
    } catch (error) {
      console.error('[expense_parse] OpenAI error:', error.message);
      throw ApiError.serviceUnavailable('Could not parse voice expense. Try again shortly.');
    }

    let parsed;

    try {
      parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
    } catch (error) {
      throw ApiError.serviceUnavailable('Could not understand the expense. Please fill the form.');
    }

    const category = EXPENSE_CATEGORIES.includes(parsed.category) ? parsed.category : 'other';
    const amount = parsed.amount != null && !Number.isNaN(Number(parsed.amount))
      ? Number(parsed.amount)
      : null;

    return {
      title: String(parsed.title || '').slice(0, 150) || (category !== 'other' ? category : 'Expense'),
      category,
      quantity: parsed.quantity != null && !Number.isNaN(Number(parsed.quantity))
        ? Number(parsed.quantity)
        : null,
      unit: parsed.unit ? String(parsed.unit).slice(0, 40) : null,
      amount,
      expense_date: this.#normalizeDate(parsed.expense_date) || today,
      notes: parsed.notes ? String(parsed.notes) : null,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      transcript: trimmed,
      plot_id,
      crop_cycle_id,
    };
  }

  #normalizeDate(value) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString().slice(0, 10);
  }
}

module.exports = new ExpenseParseService();
