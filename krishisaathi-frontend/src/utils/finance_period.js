/**
 * Indian crop seasons drive how farmers think about money, so totals are scoped to a
 * season (or a custom date range) instead of showing every rupee ever logged.
 *
 * kharif: Jun 1 - Oct 31 | rabi: Nov 1 - Mar 31 (next year) | zaid: Apr 1 - May 31
 */
const SEASON_ORDER = ['rabi', 'zaid', 'kharif'];

export const ALL_TIME = 'all';
export const CUSTOM = 'custom';

export function currentSeason(reference_date = new Date()) {
  const month = reference_date.getMonth();
  const year = reference_date.getFullYear();

  if (month >= 5 && month <= 9) {
    return { season: 'kharif', year };
  }

  if (month === 3 || month === 4) {
    return { season: 'zaid', year };
  }

  // Nov-Dec start a rabi season; Jan-Mar still belong to the one that started last year.
  return { season: 'rabi', year: month >= 10 ? year : year - 1 };
}

export function previousSeason({ season, year }) {
  const index = SEASON_ORDER.indexOf(season);

  if (index > 0) {
    return { season: SEASON_ORDER[index - 1], year };
  }

  return { season: 'kharif', year: year - 1 };
}

export function seasonRange({ season, year }) {
  if (season === 'kharif') {
    return { from: `${year}-06-01`, to: `${year}-10-31` };
  }

  if (season === 'zaid') {
    return { from: `${year}-04-01`, to: `${year}-05-31` };
  }

  return { from: `${year}-11-01`, to: `${year + 1}-03-31` };
}

/**
 * Turns a period key into an inclusive date range. Keys are `this_season`,
 * `last_season`, `custom`, or `all`. Pass `custom_range` when key is custom.
 */
export function periodRange(period_key, reference_date = new Date(), custom_range = {}) {
  if (!period_key || period_key === ALL_TIME) {
    return { from: null, to: null };
  }

  if (period_key === CUSTOM) {
    return {
      from: normalizeDate(custom_range.from),
      to: normalizeDate(custom_range.to),
    };
  }

  if (period_key === 'this_season') {
    return seasonRange(currentSeason(reference_date));
  }

  if (period_key === 'last_season') {
    return seasonRange(previousSeason(currentSeason(reference_date)));
  }

  const year = yearFromKey(period_key);
  return year ? { from: `${year}-01-01`, to: `${year}-12-31` } : { from: null, to: null };
}

/** The period a farmer would naturally compare against, or null when there is none. */
export function comparisonPeriod(period_key, reference_date = new Date()) {
  if (period_key === 'this_season') {
    return { label_key: 'last_season', range: periodRange('last_season', reference_date) };
  }

  if (period_key === 'last_season') {
    const two_back = previousSeason(previousSeason(currentSeason(reference_date)));
    return { label_key: 'previous_season', range: seasonRange(two_back) };
  }

  return null;
}

/**
 * Compact period chips for the main bar: current and previous season only.
 * Custom dates / all-time live in the More filters sheet.
 */
export function periodOptions() {
  return [
    { key: 'this_season', is_season: true },
    { key: 'last_season', is_season: true },
  ];
}

export function primaryPeriodOptions() {
  return periodOptions();
}

/** Ready-made date windows offered inside the filter sheet. */
export const QUICK_RANGES = ['this_month', 'last_month', 'last_30_days', 'this_year'];

export function quickRange(key, reference_date = new Date()) {
  const year = reference_date.getFullYear();
  const month = reference_date.getMonth();

  if (key === 'this_month') {
    return { from: isoDate(new Date(year, month, 1)), to: isoDate(new Date(year, month + 1, 0)) };
  }

  if (key === 'last_month') {
    return { from: isoDate(new Date(year, month - 1, 1)), to: isoDate(new Date(year, month, 0)) };
  }

  if (key === 'last_30_days') {
    const start = new Date(reference_date);
    start.setDate(start.getDate() - 29);
    return { from: isoDate(start), to: isoDate(reference_date) };
  }

  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Human label for a from/to pair, e.g. "1 Jun 2026 – 30 Jun 2026". */
export function rangeLabel(from, to, language = 'en') {
  if (!from && !to) {
    return '';
  }

  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  const start = from ? formatDay(from, locale) : null;
  const end = to ? formatDay(to, locale) : null;

  if (start && end) {
    return start === end ? start : `${start} – ${end}`;
  }

  return start || end;
}

function formatDay(iso_date, locale) {
  const date = new Date(`${String(iso_date).slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function isoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** One-line season label such as "Kharif 2026" or "Rabi 2025-26". */
export function seasonChipLabel(option_key, t) {
  if (option_key === ALL_TIME) {
    return t('money.period_all');
  }

  if (option_key === CUSTOM) {
    return t('money.period_custom');
  }

  const season = option_key === 'this_season'
    ? currentSeason()
    : previousSeason(currentSeason());
  const name = t(`crops.season.${season.season}`);
  const year = season.season === 'rabi'
    ? `${season.year}-${String(season.year + 1).slice(2)}`
    : String(season.year);

  return `${name} ${year}`;
}

function yearFromKey(period_key) {
  const match = /^year:(\d{4})$/.exec(String(period_key || ''));
  return match ? Number(match[1]) : null;
}

export function periodYear(period_key) {
  return yearFromKey(period_key);
}

export function isWithinRange(date_value, { from, to }) {
  if (!from && !to) {
    return true;
  }

  const date = String(date_value || '').slice(0, 10);

  if (!date) {
    return false;
  }

  return (!from || date >= from) && (!to || date <= to);
}

function normalizeDate(value) {
  const text = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
