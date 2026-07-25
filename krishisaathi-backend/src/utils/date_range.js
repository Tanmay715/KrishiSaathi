const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Reads `from` / `to` query params, ignoring anything that is not a plain YYYY-MM-DD date. */
function parseDateRange(query = {}) {
  const from = normalizeDate(query.from);
  const to = normalizeDate(query.to);

  if (from && to && from > to) {
    return { from: to, to: from };
  }

  return { from, to };
}

function normalizeDate(value) {
  const text = String(value || '').trim().slice(0, 10);
  return ISO_DATE_PATTERN.test(text) ? text : null;
}

/** Applies an inclusive date filter. An empty range leaves the query untouched (all time). */
function applyDateRange(query, column, { from, to } = {}) {
  if (from) {
    query.where(column, '>=', from);
  }

  if (to) {
    query.where(column, '<=', to);
  }

  return query;
}

module.exports = {
  parseDateRange,
  applyDateRange,
};
