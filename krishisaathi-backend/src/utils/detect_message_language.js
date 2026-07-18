const HINDI_SCRIPT_PATTERN = /[\u0900-\u097F]/;

const ROMANIZED_HINDI_WORDS = new Set([
  'aap', 'accha', 'acha', 'aloo', 'alo', 'aur', 'baarish', 'barish', 'bataiye', 'batao',
  'beej', 'bhi', 'bona', 'btaiye', 'btao', 'chahiye', 'dawa', 'dawai', 'de', 'dena',
  'dhan', 'fasal', 'fal', 'gehu', 'gehun', 'gahu', 'hai', 'hain', 'ham', 'hamara',
  'ho', 'hua', 'hui', 'huye', 'jyada', 'ka', 'kab', 'kahan', 'kaise', 'kaisa', 'kaisi',
  'kare', 'karega', 'karein', 'karna', 'karo', 'karu', 'katayi', 'ke', 'keede', 'keet',
  'khad', 'ki', 'kis', 'kitna', 'kitne', 'kitni', 'ko', 'kuch', 'kya', 'kyu', 'kyun',
  'kaun', 'khet', 'kheti', 'main', 'mai', 'makka', 'makki', 'mein', 'mera', 'meri',
  'mere', 'milega', 'mosam', 'mausam', 'na', 'nahi', 'nahin', 'paani', 'pani', 'par',
  'patte', 'patti', 'pattiyan', 'pe', 'phul', 'pyaj', 'sab', 'se', 'sinchai', 'sichai',
  'spray', 'tamatar', 'theek', 'thoda', 'tum', 'urea', 'vo', 'voh', 'woh', 'ye', 'yeh',
  'zyada', 'bahut',
]);

function normalizeToken(token) {
  return token.toLowerCase().replace(/[^a-z\u0900-\u097F]/g, '');
}

function isRomanizedHindi(message) {
  const tokens = String(message || '')
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  const hindi_hits = tokens.filter((token) => ROMANIZED_HINDI_WORDS.has(token)).length;
  const hit_ratio = hindi_hits / tokens.length;

  return hindi_hits >= 1 && (tokens.length <= 4 || hit_ratio >= 0.15);
}

function detectMessageLanguage(message) {
  const text = String(message || '').trim();

  if (!text) {
    return 'en';
  }

  if (HINDI_SCRIPT_PATTERN.test(text)) {
    return 'hi';
  }

  return isRomanizedHindi(text) ? 'hi' : 'en';
}

module.exports = {
  detectMessageLanguage,
};
