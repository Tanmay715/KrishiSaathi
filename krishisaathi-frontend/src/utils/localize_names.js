import { normalizeLanguage } from './language';
import { INDIAN_STATES } from '../config/indian_states';

/**
 * Government feeds (AGMARKNET, Open-Meteo) only speak English, so crop and place names
 * arriving from the API are mapped to Hindi here before they reach the screen.
 */
const CROP_NAMES_HI = {
  wheat: 'गेहूँ',
  rice: 'चावल',
  paddy: 'धान',
  potato: 'आलू',
  onion: 'प्याज',
  tomato: 'टमाटर',
  mustard: 'सरसों',
  moong: 'मूँग',
  chana: 'चना',
  gram: 'चना',
  cotton: 'कपास',
  maize: 'मक्का',
  sugarcane: 'गन्ना',
  soybean: 'सोयाबीन',
  groundnut: 'मूँगफली',
  bajra: 'बाजरा',
  jowar: 'ज्वार',
  barley: 'जौ',
  arhar: 'अरहर',
  tur: 'अरहर',
  urad: 'उड़द',
  masoor: 'मसूर',
  garlic: 'लहसुन',
  ginger: 'अदरक',
  chilli: 'मिर्च',
  brinjal: 'बैंगन',
  cabbage: 'पत्तागोभी',
  cauliflower: 'फूलगोभी',
  peas: 'मटर',
  banana: 'केला',
  mango: 'आम',
  sesame: 'तिल',
  turmeric: 'हल्दी',
};

export function localizeCropName(crop_name, language) {
  const raw = String(crop_name || '').trim();

  if (!raw || normalizeLanguage(language) !== 'hi') {
    return raw;
  }

  const key = raw.toLowerCase();
  const direct = CROP_NAMES_HI[key];

  if (direct) {
    return direct;
  }

  // AGMARKNET labels look like "Paddy(Dhan)(Common)" — match on the leading word.
  const head = key.split(/[^a-z]+/).filter(Boolean)[0];
  return CROP_NAMES_HI[head] || raw;
}

export function localizeState(state_name, language) {
  const target = String(state_name || '').trim();

  if (!target) {
    return '';
  }

  const match = INDIAN_STATES.find((state) => (
    state.label_en.toLowerCase() === target.toLowerCase() || state.label_hi === target
  ));

  if (!match) {
    return '';
  }

  return normalizeLanguage(language) === 'hi' ? match.label_hi : match.label_en;
}

/** District names have no Hindi list, so they pass through unchanged. */
export function localizePlaceLabel(place, language, fallback = '') {
  const district = String(place?.district || '').trim();
  const state = localizeState(place?.state, language) || String(place?.state || '').trim();
  const label = [district, state].filter(Boolean).join(', ');

  return label || fallback;
}
