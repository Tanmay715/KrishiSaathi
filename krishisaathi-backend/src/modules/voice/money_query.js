const db = require('../../db/connection');

/**
 * Spoken words → search terms that should hit title OR category.
 * Farmers often save the Hindi title ("खाद") while category is English ("fertilizer").
 */
const TITLE_ALIASES = {
  diesel: ['diesel', 'डीजल', 'disel', 'transport'],
  urea: ['urea', 'यूरिया', 'fertilizer', 'खाद'],
  labour: ['labour', 'labor', 'मजदूर', 'मज़दूर', 'मजदूरी'],
  labor: ['labour', 'labor', 'मजदूर', 'मज़दूर', 'मजदूरी'],
  seed: ['seed', 'बीज'],
  fertilizer: ['fertilizer', 'खाद', 'खाद्य', 'khaad', 'khad', 'urea', 'dap', 'npk', 'यूरिया'],
  khaad: ['fertilizer', 'खाद', 'khaad', 'khad', 'urea', 'dap', 'यूरिया'],
  khad: ['fertilizer', 'खाद', 'khaad', 'khad', 'urea', 'dap', 'यूरिया'],
  pesticide: ['pesticide', 'spray', 'कीटनाशक', 'स्प्रे', 'दवा'],
  irrigation: ['irrigation', 'पानी', 'सिंचाई'],
  transport: ['transport', 'diesel', 'डीजल', 'भाड़ा'],
  equipment: ['equipment', 'pump', 'pipe', 'औज़ार', 'पंप'],
  'डीजल': ['diesel', 'डीजल', 'transport'],
  'खाद': ['fertilizer', 'खाद', 'khaad', 'khad', 'urea', 'dap', 'यूरिया'],
  'यूरिया': ['urea', 'यूरिया', 'fertilizer', 'खाद'],
  'बीज': ['seed', 'बीज'],
  'मजदूर': ['labour', 'labor', 'मजदूर', 'मज़दूर'],
  'मज़दूरी': ['labour', 'labor', 'मजदूर', 'मज़दूर'],
  'मजदूरी': ['labour', 'labor', 'मजदूर', 'मज़दूर'],
  'दवा': ['pesticide', 'spray', 'दवा', 'कीटनाशक'],
  'कीटनाशक': ['pesticide', 'spray', 'दवा', 'कीटनाशक'],
  'सिंचाई': ['irrigation', 'पानी', 'सिंचाई'],
  'पानी': ['irrigation', 'पानी', 'सिंचाई'],
  'भाड़ा': ['transport', 'भाड़ा', 'diesel', 'डीजल'],
};

const QUERY_TO_CATEGORY = {
  fertilizer: 'fertilizer',
  khaad: 'fertilizer',
  khad: 'fertilizer',
  खाद: 'fertilizer',
  urea: 'fertilizer',
  यूरिया: 'fertilizer',
  dap: 'fertilizer',
  npk: 'fertilizer',
  seed: 'seed',
  बीज: 'seed',
  pesticide: 'pesticide',
  spray: 'pesticide',
  दवा: 'pesticide',
  कीटनाशक: 'pesticide',
  irrigation: 'irrigation',
  सिंचाई: 'irrigation',
  पानी: 'irrigation',
  labour: 'labor',
  labor: 'labor',
  मजदूर: 'labor',
  मज़दूर: 'labor',
  मजदूरी: 'labor',
  diesel: 'transport',
  डीजल: 'transport',
  भाड़ा: 'transport',
  transport: 'transport',
  equipment: 'equipment',
};

/**
 * Words farmers wrap around a real question ("जुलाई का पूरा खर्च बताओ"). They must
 * never become a search term, otherwise a plain total looks like "nothing found".
 */
const FILLER_WORDS = new Set([
  'पूरा', 'पूरी', 'पुरा', 'सारा', 'सारी', 'सब', 'कुल', 'टोटल', 'कितना', 'कितने', 'कितनी',
  'खर्च', 'ख़र्च', 'खर्चा', 'ख़र्चा', 'खर्चे', 'आय', 'आमदनी', 'कमाई', 'पैसा', 'पैसे', 'हिसाब',
  'बताओ', 'बता', 'बताइए', 'दिखाओ', 'हुआ', 'हुए', 'हुई', 'में', 'का', 'की', 'के', 'पर', 'से', 'तक',
  'pura', 'poora', 'puro', 'sara', 'saara', 'sab', 'kul', 'total', 'kitna', 'kitne', 'kitni',
  'kharch', 'kharcha', 'kharche', 'aay', 'kamai', 'paisa', 'paise', 'hisab', 'hisaab',
  'batao', 'bata', 'dikhao', 'how', 'much', 'many', 'tell', 'show', 'me', 'my', 'all',
  'spend', 'spent', 'spending', 'expense', 'expenses', 'income', 'earned', 'earning',
  'money', 'the', 'of', 'on', 'in', 'for', 'and', 'ka', 'ki', 'ke', 'mein', 'par', 'hua',
]);

const CATEGORY_LABELS = {
  seed: { en: 'seed', hi: 'बीज' },
  fertilizer: { en: 'fertilizer', hi: 'खाद' },
  pesticide: { en: 'pesticide', hi: 'दवा' },
  irrigation: { en: 'irrigation', hi: 'सिंचाई' },
  labor: { en: 'labour', hi: 'मजदूरी' },
  equipment: { en: 'equipment', hi: 'औज़ार' },
  transport: { en: 'transport', hi: 'भाड़ा' },
  harvest: { en: 'harvest', hi: 'कटाई' },
  sale: { en: 'sale', hi: 'बिक्री' },
  subsidy: { en: 'subsidy', hi: 'सब्सिडी' },
  other: { en: 'other', hi: 'अन्य' },
  khaad: { en: 'fertilizer', hi: 'खाद' },
  khad: { en: 'fertilizer', hi: 'खाद' },
  खाद: { en: 'fertilizer', hi: 'खाद' },
};

/**
 * Answers "how much did I spend" questions from the farmer's own ledger. A named
 * item that matches nothing falls back to the plain total for the same period.
 */
async function summarizeMoney(user_id, filters = {}) {
  const kind = filters.kind === 'income' ? 'income' : 'expense';
  const rows = await fetchLedgerRows(user_id, kind, filters);
  const needle = normalizeQuery(filters.query);
  const category = filters.category || categoryFromNeedle(needle);
  const matched = rows.filter((row) => matchesRow(row, needle, category));
  const has_narrowing = Boolean(needle || category);
  const is_empty_narrow = has_narrowing && matched.length === 0 && rows.length > 0;
  const final_rows = is_empty_narrow ? rows : matched;
  const display_key = category || needle;

  return {
    kind,
    total: final_rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    count: final_rows.length,
    from: filters.from || null,
    to: filters.to || null,
    query: is_empty_narrow ? null : needle,
    category: is_empty_narrow ? null : category,
    missed_query: is_empty_narrow ? display_key : null,
    breakdown: topBreakdown(final_rows),
  };
}

async function fetchLedgerRows(user_id, kind, filters) {
  const table = kind === 'income' ? 'farm_incomes' : 'farm_expenses';
  const date_column = kind === 'income' ? 'income_date' : 'expense_date';

  let query = db(table)
    .join('farms', `${table}.farm_id`, 'farms.id')
    .where('farms.user_id', user_id)
    .where('farms.is_active', true)
    .select(`${table}.amount`, `${table}.title`, `${table}.category`, `${table}.${date_column} as entry_date`);

  if (filters.from) {
    query = query.andWhere(`${table}.${date_column}`, '>=', filters.from);
  }

  if (filters.to) {
    query = query.andWhere(`${table}.${date_column}`, '<=', filters.to);
  }

  if (filters.farm_id) {
    query = query.andWhere(`${table}.farm_id`, filters.farm_id);
  }

  return query;
}

/** Drops filler words so "पूरा खर्च" reads as "no item named" instead of an item. */
function normalizeQuery(raw) {
  // Keep \p{M} (matras like ा ि ी) — stripping them turns खाद into ख द.
  const text = String(raw || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return null;
  }

  const words = text.split(/\s+/).filter((word) => word && !FILLER_WORDS.has(word));
  return words.length > 0 ? words.join(' ') : null;
}

function categoryFromNeedle(needle) {
  if (!needle) {
    return null;
  }

  if (QUERY_TO_CATEGORY[needle]) {
    return QUERY_TO_CATEGORY[needle];
  }

  const word = needle.split(/\s+/).find((part) => QUERY_TO_CATEGORY[part]);
  return word ? QUERY_TO_CATEGORY[word] : null;
}

/**
 * Match if the row's title/category hits ANY expanded term. Category and query are
 * OR'd — Hindi title "खाद" with English category "other" must still count.
 */
function matchesRow(row, needle, category) {
  const terms = expandSearchTerms(needle, category);

  if (!terms.length) {
    return true;
  }

  const haystack = `${row.title || ''} ${row.category || ''}`.toLowerCase().normalize('NFC');
  return terms.some((term) => haystack.includes(term));
}

function expandSearchTerms(needle, category) {
  const terms = new Set();

  function addTerm(value) {
    const text = String(value || '').toLowerCase().normalize('NFC').trim();
    if (!text || FILLER_WORDS.has(text)) {
      return;
    }

    terms.add(text);
    (TITLE_ALIASES[text] || []).forEach((alias) => terms.add(String(alias).toLowerCase()));
  }

  addTerm(category);
  addTerm(needle);

  String(needle || '')
    .split(/\s+/)
    .forEach((word) => addTerm(word));

  return [...terms];
}

function topBreakdown(rows, limit = 3) {
  const totals = new Map();

  rows.forEach((row) => {
    const key = row.category || 'other';
    totals.set(key, (totals.get(key) || 0) + Number(row.amount || 0));
  });

  return [...totals.entries()]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function formatMoneyAnswer(summary, language) {
  const is_hi = language === 'hi';

  if (summary.count === 0) {
    return emptyAnswer(summary, is_hi);
  }

  const amount = formatRupees(summary.total);
  const when = formatRangeLabel(summary.from, summary.to, is_hi);
  const label = categoryLabel(summary.category || summary.query, is_hi);
  const head = is_hi
    ? hindiTotalLine(summary, amount, when, label)
    : englishTotalLine(summary, amount, when, label);

  return [head, missedNote(summary, is_hi), breakdownLine(summary, is_hi)].filter(Boolean).join(' ');
}

function hindiTotalLine(summary, amount, when, label) {
  const verb = summary.kind === 'income' ? 'की आय हुई' : 'का खर्च हुआ';
  const on_label = label ? `${label} पर ` : '';
  return `${when}${on_label}कुल ${amount} ${verb} (${summary.count} एंट्री)।`;
}

function englishTotalLine(summary, amount, when, label) {
  const verb = summary.kind === 'income' ? 'earned' : 'spent';
  const on_label = label ? ` on ${label}` : '';
  return `You ${verb} ${amount}${on_label}${when ? ` ${when}` : ''} across ${summary.count} entries.`;
}

function missedNote(summary, is_hi) {
  if (!summary.missed_query) {
    return '';
  }

  const label = categoryLabel(summary.missed_query, is_hi);
  return is_hi
    ? `${label} का अलग से कोई हिसाब नहीं मिला, इसलिए पूरा जोड़ बताया है।`
    : `Nothing was logged separately for ${label}, so this is the full total.`;
}

function breakdownLine(summary, is_hi) {
  const parts = (summary.breakdown || [])
    .filter((row) => row.total > 0)
    .map((row) => `${categoryLabel(row.key, is_hi)} ${formatRupees(row.total)}`);

  if (parts.length < 2) {
    return '';
  }

  return is_hi ? `सबसे ज़्यादा: ${parts.join(', ')}।` : `Biggest heads: ${parts.join(', ')}.`;
}

function emptyAnswer(summary, is_hi) {
  const when = formatRangeLabel(summary.from, summary.to, is_hi);
  const label = categoryLabel(summary.query || summary.category, is_hi);

  if (is_hi) {
    const noun = summary.kind === 'income' ? 'आय' : 'खर्च';
    const on_label = label ? `${label} का ` : '';
    return `${when}${on_label}कोई ${noun} दर्ज नहीं है। जोड़ना हो तो बोलिए, मैं लिख दूँगा।`;
  }

  const noun = summary.kind === 'income' ? 'income' : 'expense';
  const on_label = label ? ` for ${label}` : '';
  return `No ${noun} is recorded${on_label}${when ? ` ${when}` : ''}. Say it aloud and I will log it.`;
}

function categoryLabel(key, is_hi) {
  if (!key) {
    return '';
  }

  const normalized = String(key).toLowerCase().normalize('NFC');
  const mapped = QUERY_TO_CATEGORY[normalized];
  const label = CATEGORY_LABELS[normalized] || CATEGORY_LABELS[mapped] || CATEGORY_LABELS[key];
  return label ? label[is_hi ? 'hi' : 'en'] : String(key);
}

function formatRupees(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function formatRangeLabel(from, to, is_hi) {
  if (!from && !to) {
    return '';
  }

  if (from && to && from.slice(0, 7) === to.slice(0, 7)) {
    const month = monthName(from, is_hi);
    return is_hi ? `${month} में ` : `in ${month}`;
  }

  if (from && to) {
    return is_hi ? `${from} से ${to} तक ` : `from ${from} to ${to}`;
  }

  if (from) {
    return is_hi ? `${from} के बाद ` : `since ${from}`;
  }

  return is_hi ? `${to} तक ` : `until ${to}`;
}

function monthName(iso_date, is_hi) {
  const date = new Date(`${String(iso_date).slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString(is_hi ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' });
}

module.exports = {
  summarizeMoney,
  formatMoneyAnswer,
  // Exported for focused matching tests without a database.
  normalizeQuery,
  matchesRow,
  categoryFromNeedle,
  expandSearchTerms,
};
