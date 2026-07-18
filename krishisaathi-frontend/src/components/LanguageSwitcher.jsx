import { useTranslation } from 'react-i18next';
import {
  getLanguageToggleLabel,
  getNextLanguage,
  normalizeLanguage,
} from '../utils/language';

function LanguageSwitcher({ variant = 'topbar', className = '' }) {
  const { i18n, t } = useTranslation();
  const current = normalizeLanguage(i18n.resolvedLanguage || i18n.language || 'en');
  const label = getLanguageToggleLabel(current);

  function handleToggle() {
    const next_lang = getNextLanguage(current);
    localStorage.setItem('ks_language', next_lang);
    void i18n.changeLanguage(next_lang);
  }

  return (
    <button
      type="button"
      className={`language-switcher is-${variant}${className ? ` ${className}` : ''}`}
      onClick={handleToggle}
      aria-label={t('common.language_toggle', { defaultValue: 'Switch language' })}
      data-lang={current}
      data-label={label}
    >
      <span className="language-switcher-label" aria-hidden={false}>
        {label}
      </span>
    </button>
  );
}

export default LanguageSwitcher;
