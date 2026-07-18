/**
 * Normalize i18n language codes to the app's supported set.
 * i18n.language can be "en", "en-US", "hi-IN", etc. during init/navigation.
 */
export function normalizeLanguage(language) {
  const raw = String(language || '').toLowerCase();
  if (raw.startsWith('hi')) {
    return 'hi';
  }
  return 'en';
}

export function getLanguageToggleLabel(language) {
  return normalizeLanguage(language) === 'en' ? 'हिंदी' : 'English';
}

export function getNextLanguage(language) {
  return normalizeLanguage(language) === 'en' ? 'hi' : 'en';
}
