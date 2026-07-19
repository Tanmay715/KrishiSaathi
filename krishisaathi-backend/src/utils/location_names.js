/**
 * Language-aware place helpers for India.
 * Geocoding uses Open-Meteo (any language). No fixed district dictionary required.
 */

const STATE_BY_CODE = {
  AP: { en: 'Andhra Pradesh', hi: 'आंध्र प्रदेश' },
  AS: { en: 'Assam', hi: 'असम' },
  BR: { en: 'Bihar', hi: 'बिहार' },
  CT: { en: 'Chhattisgarh', hi: 'छत्तीसगढ़' },
  DL: { en: 'Delhi', hi: 'दिल्ली' },
  GJ: { en: 'Gujarat', hi: 'गुजरात' },
  HR: { en: 'Haryana', hi: 'हरियाणा' },
  HP: { en: 'Himachal Pradesh', hi: 'हिमाचल प्रदेश' },
  JH: { en: 'Jharkhand', hi: 'झारखंड' },
  KA: { en: 'Karnataka', hi: 'कर्नाटक' },
  KL: { en: 'Kerala', hi: 'केरल' },
  MP: { en: 'Madhya Pradesh', hi: 'मध्य प्रदेश' },
  MH: { en: 'Maharashtra', hi: 'महाराष्ट्र' },
  OR: { en: 'Odisha', hi: 'ओडिशा' },
  PB: { en: 'Punjab', hi: 'पंजाब' },
  RJ: { en: 'Rajasthan', hi: 'राजस्थान' },
  TN: { en: 'Tamil Nadu', hi: 'तमिल नाडु' },
  TS: { en: 'Telangana', hi: 'तेलंगाना' },
  UP: { en: 'Uttar Pradesh', hi: 'उत्तर प्रदेश' },
  UK: { en: 'Uttarakhand', hi: 'उत्तराखंड' },
  WB: { en: 'West Bengal', hi: 'पश्चिम बंगाल' },
};

const SCRIPT_LANGUAGE_RULES = [
  { test: /[\u0900-\u097F]/, languages: ['hi', 'en'] }, // Devanagari (Hindi/Marathi)
  { test: /[\u0980-\u09FF]/, languages: ['bn', 'en'] }, // Bengali
  { test: /[\u0A00-\u0A7F]/, languages: ['pa', 'en'] }, // Gurmukhi
  { test: /[\u0A80-\u0AFF]/, languages: ['gu', 'en'] }, // Gujarati
  { test: /[\u0B00-\u0B7F]/, languages: ['or', 'en'] }, // Odia
  { test: /[\u0B80-\u0BFF]/, languages: ['ta', 'en'] }, // Tamil
  { test: /[\u0C00-\u0C7F]/, languages: ['te', 'en'] }, // Telugu
  { test: /[\u0C80-\u0CFF]/, languages: ['kn', 'en'] }, // Kannada
  { test: /[\u0D00-\u0D7F]/, languages: ['ml', 'en'] }, // Malayalam
];

function cleanPlaceText(value = '') {
  return String(value || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectQueryLanguages(text = '') {
  const value = cleanPlaceText(text);
  for (const rule of SCRIPT_LANGUAGE_RULES) {
    if (rule.test.test(value)) {
      return rule.languages;
    }
  }
  // Latin / mixed: English first, Hindi second for romanized Indian names
  return ['en', 'hi'];
}

function resolveStateName(state_or_code = '', language = 'en') {
  const value = cleanPlaceText(state_or_code);
  if (!value) {
    return '';
  }

  const by_code = STATE_BY_CODE[value.toUpperCase()];
  if (by_code) {
    return by_code[language] || by_code.en;
  }

  return value;
}

function getStateMatchNames(state = '', state_code = '') {
  const names = new Set();
  const raw_state = cleanPlaceText(state);
  const code = cleanPlaceText(state_code).toUpperCase();

  if (raw_state) {
    names.add(raw_state);
    names.add(raw_state.toLowerCase());
  }

  const known = STATE_BY_CODE[code]
    || Object.values(STATE_BY_CODE).find((item) => (
      item.en.toLowerCase() === raw_state.toLowerCase()
      || item.hi === raw_state
    ));

  if (known) {
    names.add(known.en);
    names.add(known.en.toLowerCase());
    names.add(known.hi);
  }

  return [...names].filter(Boolean);
}

function buildSearchQueries({ district, state, state_code }) {
  const district_name = cleanPlaceText(district);
  const state_en = resolveStateName(state || state_code, 'en');
  const queries = [];

  if (district_name) {
    queries.push(district_name);
    if (state_en) {
      queries.push(`${district_name}, ${state_en}`);
    }
  } else if (state_en) {
    queries.push(state_en);
  }

  return [...new Set(queries)];
}

function scoreGeocodeResult(place, state_match_names = []) {
  if (!place || place.country_code !== 'IN') {
    return -1;
  }

  let score = 0;
  const admin1 = cleanPlaceText(place.admin1);
  const admin2 = cleanPlaceText(place.admin2);
  const name = cleanPlaceText(place.name);
  const feature = String(place.feature_code || '');

  if (state_match_names.length) {
    const matched_state = state_match_names.some((candidate) => {
      const needle = candidate.toLowerCase();
      return admin1.toLowerCase().includes(needle) || needle.includes(admin1.toLowerCase());
    });
    score += matched_state ? 100 : -40;
  }

  // Prefer towns / districts over tiny POIs
  if (['PPLA', 'PPLA2', 'PPLA3', 'PPL', 'ADM2', 'ADM3'].includes(feature)) {
    score += 25;
  }

  if (admin2 && name && admin2.toLowerCase() === name.toLowerCase()) {
    score += 15;
  }

  score += Math.min(Number(place.population || 0) / 50000, 20);
  return score;
}

function pickBestGeocodeResult(results = [], state_match_names = []) {
  let best = null;
  let best_score = -Infinity;

  results.forEach((place) => {
    const score = scoreGeocodeResult(place, state_match_names);
    if (score > best_score) {
      best = place;
      best_score = score;
    }
  });

  if (!best || best_score < 0) {
    return null;
  }

  return best;
}

module.exports = {
  STATE_BY_CODE,
  cleanPlaceText,
  detectQueryLanguages,
  resolveStateName,
  getStateMatchNames,
  buildSearchQueries,
  scoreGeocodeResult,
  pickBestGeocodeResult,
};
