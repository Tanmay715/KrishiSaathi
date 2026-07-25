/**
 * Deterministic helpers for farm/plot voice drafts. The model sometimes treats
 * "नया खेत जोड़ो" as a farm name or mis-hears area, so we sanitize from the transcript.
 */

const COMMAND_NAME_PATTERNS = [
  /^naya\s*khet\b/i,
  /^naya\s*farm\b/i,
  /^new\s*farm\b/i,
  /^add\s*(a\s*)?(new\s*)?farm\b/i,
  /^create\s*(a\s*)?(new\s*)?farm\b/i,
  /^नया\s*खेत/,
  /^नये\s*खेत/,
  /^नया\s*फार्म/,
  /खेत\s*जोड़/,
  /खेत\s*बना/,
  /फार्म\s*जोड़/,
  /^add\s*(a\s*)?(new\s*)?plot\b/i,
  /^नया\s*प्लॉट/,
  /प्लॉट\s*जोड़/,
];

const HINDI_NUMBERS = {
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5,
  'छह': 6, 'छे': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'पंद्रह': 15, 'बीस': 20, 'पच्चीस': 25,
  'तीस': 30, 'पचास': 50,
};

const AREA_UNIT = String.raw`(?:bigha|bighas|बीघा|बीघे|बिघा|acre|acres|एकड़|एकड|hectare|hectares|हेक्टेयर)?`;

function isCommandPhraseName(name) {
  const text = String(name || '').trim();
  if (!text) {
    return true;
  }

  return COMMAND_NAME_PATTERNS.some((pattern) => pattern.test(text));
}

/** Prefer a real farm/plot name; reject command phrases like "नया खेत". */
function sanitizeStructureName(name) {
  const text = String(name || '').trim().slice(0, 150);
  return text && !isCommandPhraseName(text) ? text : null;
}

/**
 * Pull the land area number from speech. Keeps the farmer's number as-is
 * (4 bigha → 4) — the app already uses their preferred land unit.
 */
function parseSpokenArea(spoken) {
  const text = String(spoken || '').trim();
  if (!text) {
    return null;
  }

  const digit = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${AREA_UNIT}`, 'i'));
  if (digit) {
    return toPositiveNumber(digit[1]);
  }

  const hindi = text.match(new RegExp(`(${Object.keys(HINDI_NUMBERS).join('|')})\\s*${AREA_UNIT}`, 'i'));
  if (hindi) {
    return HINDI_NUMBERS[hindi[1]] || null;
  }

  return null;
}

function toPositiveNumber(value) {
  const number = Number(value);
  return value != null && !Number.isNaN(number) && number > 0 ? number : null;
}

module.exports = {
  isCommandPhraseName,
  sanitizeStructureName,
  parseSpokenArea,
};
