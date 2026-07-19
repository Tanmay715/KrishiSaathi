/** Map Hindi / alternate spellings to English names Open-Meteo understands. */
const DISTRICT_ALIASES = {
  'आज़मगढ़': 'Azamgarh',
  'आजामगढ़': 'Azamgarh',
  'आजमगढ़': 'Azamgarh',
  'azamgarh': 'Azamgarh',
  'वाराणसी': 'Varanasi',
  'बनारस': 'Varanasi',
  'लखनऊ': 'Lucknow',
  'कानपुर': 'Kanpur',
  'गोरखपुर': 'Gorakhpur',
  'प्रयागराज': 'Prayagraj',
  'इलाहाबाद': 'Prayagraj',
  'आगरा': 'Agra',
  'मेरठ': 'Meerut',
  'नोएडा': 'Noida',
  'गाजियाबाद': 'Ghaziabad',
  'पटना': 'Patna',
  'रांची': 'Ranchi',
  'जयपुर': 'Jaipur',
  'इंदौर': 'Indore',
  'भोपाल': 'Bhopal',
  'नागपुर': 'Nagpur',
  'पुणे': 'Pune',
  'मुंबई': 'Mumbai',
  'दिल्ली': 'Delhi',
  'नई दिल्ली': 'New Delhi',
};

const STATE_CODE_TO_EN = {
  AP: 'Andhra Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CT: 'Chhattisgarh',
  DL: 'Delhi',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JH: 'Jharkhand',
  KA: 'Karnataka',
  KL: 'Kerala',
  MP: 'Madhya Pradesh',
  MH: 'Maharashtra',
  OR: 'Odisha',
  PB: 'Punjab',
  RJ: 'Rajasthan',
  TN: 'Tamil Nadu',
  TS: 'Telangana',
  UP: 'Uttar Pradesh',
  UK: 'Uttarakhand',
  WB: 'West Bengal',
};

function hasDevanagari(text = '') {
  return /[\u0900-\u097F]/.test(String(text));
}

function normalizeDistrictName(district = '') {
  const raw = String(district || '').trim();
  if (!raw) {
    return '';
  }

  const key = raw.toLowerCase();
  if (DISTRICT_ALIASES[raw]) {
    return DISTRICT_ALIASES[raw];
  }
  if (DISTRICT_ALIASES[key]) {
    return DISTRICT_ALIASES[key];
  }

  return raw;
}

function resolveStateName(state_or_code = '') {
  const value = String(state_or_code || '').trim();
  if (!value) {
    return '';
  }

  if (STATE_CODE_TO_EN[value.toUpperCase()]) {
    return STATE_CODE_TO_EN[value.toUpperCase()];
  }

  return value;
}

function buildLocationParts({ district, state, state_code }) {
  const district_name = normalizeDistrictName(district);
  const state_name = resolveStateName(state || state_code);
  return [district_name, state_name, 'India'].filter(Boolean);
}

module.exports = {
  DISTRICT_ALIASES,
  STATE_CODE_TO_EN,
  hasDevanagari,
  normalizeDistrictName,
  resolveStateName,
  buildLocationParts,
};
