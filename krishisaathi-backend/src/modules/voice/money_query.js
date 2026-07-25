const db = require('../../db/connection');

const TITLE_ALIASES = {
  diesel: ['diesel', 'डीजल', 'disel'],
  urea: ['urea', 'यूरिया'],
  labour: ['labour', 'labor', 'मजदूर', 'मज़दूर'],
  seed: ['seed', 'बीज'],
  fertilizer: ['fertilizer', 'खाद', 'urea', 'dap', 'यूरिया'],
  pesticide: ['pesticide', 'spray', 'कीटनाशक', 'स्प्रे'],
  irrigation: ['irrigation', 'पानी', 'सिंचाई'],
};

/**
 * Answers "how much did I spend on X" style questions from the farmer's own ledger.
 */
async function summarizeMoney(user_id, filters = {}) {
  const kind = filters.kind === 'income' ? 'income' : 'expense';
  const table = kind === 'income' ? 'farm_incomes' : 'farm_expenses';
  const date_column = kind === 'income' ? 'income_date' : 'expense_date';

  let query = db(table)
    .join('farms', `${table}.farm_id`, 'farms.id')
    .where('farms.user_id', user_id)
    .where('farms.is_active', true)
    .select(
      `${table}.amount`,
      `${table}.title`,
      `${table}.category`,
      `${table}.${date_column} as entry_date`,
      'farms.name as farm_name',
    );

  if (filters.from) {
    query = query.andWhere(`${table}.${date_column}`, '>=', filters.from);
  }

  if (filters.to) {
    query = query.andWhere(`${table}.${date_column}`, '<=', filters.to);
  }

  if (filters.farm_id) {
    query = query.andWhere(`${table}.farm_id`, filters.farm_id);
  }

  if (filters.category) {
    query = query.andWhere(`${table}.category`, filters.category);
  }

  const rows = await query;
  const matched = rows.filter((row) => matchesTitle(row, filters.query));
  const total = matched.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    kind,
    total,
    count: matched.length,
    from: filters.from || null,
    to: filters.to || null,
    query: filters.query || null,
    category: filters.category || null,
  };
}

function matchesTitle(row, query) {
  const needle = String(query || '').trim().toLowerCase();

  if (!needle) {
    return true;
  }

  const haystack = `${row.title || ''} ${row.category || ''}`.toLowerCase();
  const aliases = TITLE_ALIASES[needle] || [needle];

  return aliases.some((alias) => haystack.includes(String(alias).toLowerCase()));
}

function formatMoneyAnswer(summary, language) {
  const amount = `₹${Number(summary.total || 0).toLocaleString('en-IN')}`;
  const is_hi = language === 'hi';
  const label = summary.query || summary.category;
  const when = formatRangeLabel(summary.from, summary.to, is_hi);

  if (summary.count === 0) {
    if (is_hi) {
      const verb = summary.kind === 'income' ? 'आय' : 'खर्च';
      return label
        ? `${when}${label} की कोई ${verb} नहीं मिली।`
        : `${when}कोई ${verb} नहीं मिली।`;
    }

    return label
      ? `No ${summary.kind === 'income' ? 'income' : 'expense'} found for ${label}${when ? ` ${when}` : ''}.`
      : `No ${summary.kind === 'income' ? 'income' : 'expenses'} found${when ? ` ${when}` : ''}.`;
  }

  if (is_hi) {
    const verb = summary.kind === 'income' ? 'मिली' : 'खर्च हुए';
    return label
      ? `${when}${label} पर कुल ${amount} ${verb} (${summary.count} एंट्री)।`
      : `${when}कुल ${amount} ${verb} (${summary.count} एंट्री)।`;
  }

  const noun = summary.kind === 'income' ? 'earned' : 'spent';
  return label
    ? `You ${noun} ${amount} on ${label}${when ? ` ${when}` : ''} across ${summary.count} entries.`
    : `You ${noun} ${amount}${when ? ` ${when}` : ''} across ${summary.count} entries.`;
}

function formatRangeLabel(from, to, is_hi) {
  if (!from && !to) {
    return is_hi ? '' : '';
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
};
