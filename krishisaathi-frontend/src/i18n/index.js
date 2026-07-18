import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import { normalizeLanguage } from '../utils/language';

const saved_language = normalizeLanguage(localStorage.getItem('ks_language') || 'en');

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: saved_language,
  fallbackLng: 'en',
  supportedLngs: ['en', 'hi'],
  nonExplicitSupportedLngs: true,
  load: 'languageOnly',
  interpolation: { escapeValue: false },
  react: {
    useSuspense: false,
  },
});

export default i18n;
