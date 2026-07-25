/**
 * Indian crop seasons drive how farmers think about money, so totals are scoped to a
 * season (or a year) instead of showing every rupee ever logged.
 *
 * kharif: Jun 1 - Oct 31 | rabi: Nov 1 - Mar 31 (next year) | zaid: Apr 1 - May 31
 */
const SEASON_ORDER = ['rabi', 'zaid', 'kharif'];

export const ALL_TIME = 'all';

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
 * `last_season`, `year:2025` or `all`. An empty range means all time.
 */
export function periodRange(period_key, reference_date = new Date()) {
  if (!period_key || period_key === ALL_TIME) {
    return { from: null, to: null };
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

  const year = yearFromKey(period_key);

  if (year) {
    return {
      label_key: 'previous_year',
      range: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    };
  }

  return null;
}

/**
 * Season and year chips, limited to years the farmer actually has entries for so the
 * control stays short for a new user and grows with history.
 */
export function periodOptions(entry_dates = [], reference_date = new Date()) {
  const this_year = reference_date.getFullYear();
  const years = [...new Set(
    entry_dates
      .map((value) => Number(String(value || '').slice(0, 4)))
      .filter((year) => year >= 2000 && year <= this_year),
  )].sort((a, b) => b - a);

  const has_history = years.some((year) => year < this_year) || years.length > 1;

  return [
    { key: 'this_season', is_season: true },
    { key: 'last_season', is_season: true },
    ...years.map((year) => ({ key: `year:${year}`, year })),
    ...(has_history || years.length ? [{ key: ALL_TIME }] : []),
  ];
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
