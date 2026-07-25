import { useTranslation } from 'react-i18next';
import {
  getLanguageToggleLabel,
  getNextLanguage,
  normalizeLanguage,
} from '../utils/language';
import { updateProfile } from '../services/auth_service';

function LanguageSwitcher({ variant = 'topbar', className = '' }) {
  const { i18n, t } = useTranslation();
  const current = normalizeLanguage(i18n.resolvedLanguage || i18n.language || 'en');
  const label = getLanguageToggleLabel(current);

  function handleToggle() {
    const next_lang = getNextLanguage(current);
    localStorage.setItem('ks_language', next_lang);
    void i18n.changeLanguage(next_lang);
    persistLanguage(next_lang);
  }

  /**
   * Server-generated text (reminders, assistant replies) follows the saved profile
   * language, so the toggle has to reach the backend too. A failure is harmless — the
   * interface has already switched.
   */
  function persistLanguage(next_lang) {
    if (!localStorage.getItem('ks_token')) {
      return;
    }

    updateProfile({ preferred_language: next_lang }).catch(() => null);
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
