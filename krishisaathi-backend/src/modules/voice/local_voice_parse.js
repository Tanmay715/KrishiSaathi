/**
 * Cheap local parsers for clear voice utterances. When these succeed we skip OpenAI.
 * Ambiguous / long Hinglish still falls through to the model.
 */
const { missingSlots } = require('./voice_slots');
const { matchTargetFromSpeech } = require('./target_matcher');
const { sanitizeStructureName, parseSpokenArea } = require('./structure_parse');

const FILLING_INTENTS = ['expense', 'income', 'reminder', 'create_farm', 'create_plot'];

const ITEM_MAP = [
  { needles: ['urea', 'यूरिया', 'dap', 'npk', 'खाद', 'khaad', 'khad'], title: 'Urea/fertilizer', category: 'fertilizer' },
  { needles: ['diesel', 'डीजल', 'petrol', 'पेट्रोल', 'भाड़ा'], title: 'Diesel/transport', category: 'transport' },
  { needles: ['seed', 'बीज', 'beej'], title: 'Seed', category: 'seed' },
  { needles: ['labour', 'labor', 'मजदूर', 'मज़दूर', 'मजदूरी'], title: 'Labour', category: 'labor' },
  { needles: ['spray', 'pesticide', 'कीटनाशक', 'दवा'], title: 'Pesticide', category: 'pesticide' },
  { needles: ['irrigation', 'सिंचाई', 'पानी', 'pump'], title: 'Irrigation', category: 'irrigation' },
];

const HINDI_ONES = {
  एक: 1, दो: 2, तीन: 3, चार: 4, पाँच: 5, पांच: 5, छह: 6, छे: 6,
  सात: 7, आठ: 8, नौ: 9, दस: 10, ग्यारह: 11, बारह: 12, पंद्रह: 15,
  बीस: 20, पच्चीस: 25, तीस: 30, पचास: 50, सौ: 100, हजार: 100,
};

/**
 * Returns { intent, fields, summary, confidence } or null when OpenAI should run.
 */
function tryLocalInterpret(spoken, { intent = null, draft = {}, targets = [], context = {} } = {}) {
  const text = String(spoken || '').trim();
  if (!text) {
    return null;
  }

  if (FILLING_INTENTS.includes(intent)) {
    return tryFillActiveSlots(text, intent, draft, targets, context);
  }

  return tryKeywordIntent(text, context);
}

function tryFillActiveSlots(spoken, intent, draft, targets, context) {
  const missing = missingSlots(intent, draft);
  if (!missing.length) {
    return null;
  }

  // Long multi-slot answers are safer with the model.
  if (spoken.length > 90 || wordCount(spoken) > 12) {
    return null;
  }

  const fields = {};
  fillStructureSlots(fields, spoken, missing, targets, context);
  fillRecordSlots(fields, spoken, intent, missing);

  if (!Object.values(fields).some((value) => value != null && value !== '')) {
    return null;
  }

  return {
    intent,
    fields,
    summary: null,
    confidence: 0.85,
  };
}

function fillStructureSlots(fields, spoken, missing, targets, context) {
  if (missing.includes('name')) {
    const name = sanitizeStructureName(spoken);
    if (name) {
      fields.name = name;
    }
  }

  if (missing.includes('total_area') || missing.includes('area')) {
    const area = parseSpokenArea(spoken) || parseBareNumber(spoken);
    if (area) {
      fields.total_area = area;
      fields.area = area;
    }
  }

  if (missing.includes('farm_id')) {
    const key = matchTargetFromSpeech(spoken, targets.filter((row) => row.target_type === 'farm'));
    if (key?.startsWith('farm:')) {
      fields.farm_id = key.slice(5);
    } else if (context.farm_id) {
      fields.farm_id = context.farm_id;
    }
  }
}

function fillRecordSlots(fields, spoken, intent, missing) {
  if (missing.includes('amount')) {
    const amount = parseSpokenAmount(spoken);
    if (amount) {
      fields.amount = amount;
    }
  }

  if (missing.includes('title')) {
    const item = matchKnownItem(spoken);
    if (item) {
      fields.title = item.title;
      fields.category = item.category;
    } else if (!isMostlyAmount(spoken)) {
      fields.title = spoken.slice(0, 150);
    }
  }

  if (missing.includes('due_at')) {
    const date = parseRelativeDate(spoken);
    if (date) {
      fields.due_at = date;
      fields.date = date;
    }
  }

  if (intent === 'reminder' && missing.includes('title') && !fields.title && !isMostlyAmount(spoken)) {
    fields.title = spoken.slice(0, 150);
  }
}

function tryKeywordIntent(spoken, context) {
  const lower = spoken.toLowerCase().normalize('NFC');

  if (isHelp(lower)) {
    return pack('help', {});
  }

  if (isCreateFarm(lower)) {
    return pack('create_farm', structureFields(spoken));
  }

  if (isCreatePlot(lower)) {
    return pack('create_plot', structureFields(spoken));
  }

  if (isMoneyQuery(lower)) {
    return pack('money_query', moneyFields(spoken, lower));
  }

  if (isReminder(lower)) {
    return pack('reminder', reminderFields(spoken));
  }

  if (isIncome(lower)) {
    return pack('income', moneyRecordFields(spoken, 'income'));
  }

  if (isExpense(lower)) {
    return pack('expense', moneyRecordFields(spoken, 'expense'));
  }

  if (looksLikeAdvice(lower) || (context.page === 'assistant' && looksLikeQuestion(lower))) {
    return pack('assistant', {});
  }

  return null;
}

function structureFields(spoken) {
  const area = parseSpokenArea(spoken);
  return {
    name: null,
    total_area: area,
    area,
  };
}

function moneyRecordFields(spoken, kind) {
  const item = matchKnownItem(spoken);
  const amount = parseSpokenAmount(spoken);

  return {
    title: item?.title || null,
    category: item?.category || (kind === 'income' ? 'sale' : null),
    amount,
    date: todayIso(),
  };
}

function reminderFields(spoken) {
  return {
    title: stripReminderLead(spoken),
    due_at: parseRelativeDate(spoken),
    reminder_type: 'custom',
  };
}

function moneyFields(spoken, lower) {
  const item = matchKnownItem(spoken);
  const month = parseMonthRange(lower);

  return {
    kind: /आय|income|earning|बेचा|sale/i.test(spoken) ? 'income' : 'expense',
    category: item?.category || null,
    query: item ? item.title.split('/')[0].toLowerCase() : null,
    date_from: month?.from || null,
    date_to: month?.to || null,
  };
}

function pack(intent, fields) {
  return { intent, fields, summary: null, confidence: 0.8 };
}

function isHelp(text) {
  return /^(help|मदद|क्या कर|what can you|menu)\b/i.test(text)
    || /क्या\s*(कर\s*)?(सकते|सकता)/.test(text);
}

function isCreateFarm(text) {
  return /नया\s*खेत|नया\s*फार्म|naya\s*khet|new\s*farm|add\s*(a\s*)?(new\s*)?farm|create\s*(a\s*)?farm/i.test(text);
}

function isCreatePlot(text) {
  return /नया\s*प्लॉट|naya\s*plot|add\s*(a\s*)?(new\s*)?plot|create\s*(a\s*)?plot|प्लॉट\s*जोड़/i.test(text);
}

function isMoneyQuery(text) {
  return /कितना\s*खर्च|कुल\s*खर्च|how\s*much|total\s*(spend|expense|income)|कितनी\s*आय|में\s*कितना/.test(text);
}

function isReminder(text) {
  return /याद\s*दिला|remind\s*me|reminder|याद\s*रखना/.test(text);
}

function isIncome(text) {
  return /बेचा|आय|income|sold|कमाई/.test(text) && /\d|सौ|हजार|हज़ार|rupee|रुपये|₹/.test(text);
}

function isExpense(text) {
  return /खर्च|खरीदा|spent|spend|खरीद/.test(text)
    || (matchKnownItem(text) && parseSpokenAmount(text));
}

function looksLikeQuestion(text) {
  return /\?|क्या|कैसे|कब|क्यों|how|what|when|why|should|बताओ|सलाह/.test(text);
}

function looksLikeAdvice(text) {
  return /कीड़े|कीट|रोग|disease|pest|स्प्रे|spray|मौसम|weather|क्या करें|what should|खाद|irrigation|सिंचाई/.test(text)
    && looksLikeQuestion(text);
}

function matchKnownItem(spoken) {
  const text = String(spoken || '').toLowerCase().normalize('NFC');
  return ITEM_MAP.find((row) => row.needles.some((needle) => text.includes(needle.toLowerCase()))) || null;
}

function parseSpokenAmount(spoken) {
  const text = String(spoken || '').trim().normalize('NFC');
  const digit = text.match(/(?:₹|rs\.?|rupees?|रुपये?|रु\.?)?\s*(\d{2,7}(?:\.\d+)?)/i)
    || text.match(/(\d{2,7}(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?|रुपये?|रु\.?)?/i);

  if (digit) {
    return toPositive(digit[1]);
  }

  const thousand = text.match(new RegExp(`(${Object.keys(HINDI_ONES).join('|')})\\s*(?:हज़ार|हजार)`, 'i'));
  if (thousand && HINDI_ONES[thousand[1]]) {
    return HINDI_ONES[thousand[1]] * 1000;
  }

  const hundred = text.match(new RegExp(`(${Object.keys(HINDI_ONES).join('|')})\\s*सौ`, 'i'));
  if (hundred && HINDI_ONES[hundred[1]]) {
    return HINDI_ONES[hundred[1]] * 100;
  }

  return null;
}

function parseBareNumber(spoken) {
  const match = String(spoken || '').trim().match(/^(\d+(?:\.\d+)?)$/);
  return match ? toPositive(match[1]) : null;
}

function parseRelativeDate(spoken) {
  const text = String(spoken || '').toLowerCase().normalize('NFC');
  const today = startOfToday();

  if (/आज|aaj|today/.test(text)) {
    return isoDate(today);
  }

  if (/कल|kal|tomorrow/.test(text) && !/परसों/.test(text)) {
    return isoDate(addDays(today, 1));
  }

  if (/परसों|day after/.test(text)) {
    return isoDate(addDays(today, 2));
  }

  if (/yesterday|कल\s*का|बीता/.test(text)) {
    return isoDate(addDays(today, -1));
  }

  return null;
}

function parseMonthRange(text) {
  const months = {
    january: 0, jan: 0, जनवरी: 0,
    february: 1, feb: 1, फरवरी: 1,
    march: 2, mar: 2, मार्च: 2,
    april: 3, apr: 3, अप्रैल: 3,
    may: 4, मई: 4,
    june: 5, jun: 5, जून: 5,
    july: 6, jul: 6, जुलाई: 6,
    august: 7, aug: 7, अगस्त: 7,
    september: 8, sep: 8, सितंबर: 8, सितम्बर: 8,
    october: 9, oct: 9, अक्टूबर: 9,
    november: 10, nov: 10, नवंबर: 10, नवम्बर: 10,
    december: 11, dec: 11, दिसंबर: 11, दिसम्बर: 11,
  };

  const hit = Object.keys(months).find((name) => text.includes(name));
  if (!hit) {
    return null;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = months[hit];
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);

  return { from: isoDate(from), to: isoDate(to) };
}

function stripReminderLead(spoken) {
  return String(spoken || '')
    .replace(/^(remind\s*me\s*to|reminder\s*to|याद\s*दिला(?:ना|ओ)?|मुझे\s*याद\s*दिला(?:ना|ओ)?)\s*/i, '')
    .trim()
    .slice(0, 150) || null;
}

function isMostlyAmount(spoken) {
  return Boolean(parseSpokenAmount(spoken)) && wordCount(spoken) <= 4 && !matchKnownItem(spoken);
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function toPositive(value) {
  const number = Number(value);
  return value != null && !Number.isNaN(number) && number > 0 ? number : null;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIso() {
  return isoDate(startOfToday());
}

module.exports = {
  tryLocalInterpret,
  parseSpokenAmount,
  matchKnownItem,
};
