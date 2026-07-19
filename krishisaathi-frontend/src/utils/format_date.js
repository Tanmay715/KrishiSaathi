export function formatMoneyDate(value, locale = 'en') {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortDate(value, locale = 'en') {
  return formatMoneyDate(value, locale);
}

/** Drop trailing zeros so "5.0000" reads as "5" on small screens. */
export function formatArea(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number === 0) {
    return '0';
  }
  return String(Number(number.toFixed(4)));
}
