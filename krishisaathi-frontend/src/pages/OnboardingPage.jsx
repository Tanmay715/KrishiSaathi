import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { updateProfile } from '../services/auth_service';
import { normalizeLanguage } from '../utils/language';
import BrandWordmark from '../components/BrandWordmark';

function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const { user, updateUser, is_authenticated } = useAuth();
  const navigate = useNavigate();
  const needs_onboarding = localStorage.getItem('ks_needs_onboarding') === '1';

  const [name, setName] = useState(user?.name || '');
  const [preferred_language, setPreferredLanguage] = useState(
    normalizeLanguage(user?.preferred_language || i18n.resolvedLanguage || i18n.language),
  );
  const [preferred_land_unit, setPreferredLandUnit] = useState(user?.preferred_land_unit || 'acre');
  const [is_saving, setIsSaving] = useState(false);
  const [error_message, setErrorMessage] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('is-auth-screen');
    document.body.classList.add('is-auth-screen');
    return () => {
      document.documentElement.classList.remove('is-auth-screen');
      document.body.classList.remove('is-auth-screen');
    };
  }, []);

  if (!is_authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!needs_onboarding) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    try {
      const response = await updateProfile({
        name: name.trim(),
        preferred_language,
        preferred_land_unit,
      });
      const next_user = response.data;
      const next_lang = normalizeLanguage(next_user.preferred_language);
      i18n.changeLanguage(next_lang);
      localStorage.setItem('ks_language', next_lang);
      updateUser(next_user);
      localStorage.removeItem('ks_needs_onboarding');
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleSkip() {
    localStorage.removeItem('ks_needs_onboarding');
    navigate('/', { replace: true });
  }

  return (
    <div className="auth-page is-premium">
      <header className="auth-brand-bar">
        <div className="auth-brand-stack">
          <BrandWordmark size="lg" show_mark />
          <span className="auth-brand-tagline">{t('app.tagline')}</span>
        </div>
      </header>

      <div className="auth-card is-onboarding">
        <div className="auth-card-icon is-sprout" aria-hidden="true">
          <span>🌱</span>
        </div>
        <h1>{t('auth.onboarding_title')}</h1>
        <p className="subtitle">{t('auth.onboarding_subtitle')}</p>

        {error_message && (
          <div className="error-banner auth-error">
            <div>{error_message}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="onboard-name">{t('auth.name_label')}</label>
            <input
              id="onboard-name"
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="onboard-language">{t('auth.language_label')}</label>
              <select
                id="onboard-language"
                className="form-select"
                value={preferred_language}
                onChange={(event) => setPreferredLanguage(event.target.value)}
              >
                <option value="en">{t('common.english')}</option>
                <option value="hi">{t('common.hindi')}</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="onboard-unit">{t('auth.land_unit_label')}</label>
              <select
                id="onboard-unit"
                className="form-select"
                value={preferred_land_unit}
                onChange={(event) => setPreferredLandUnit(event.target.value)}
              >
                <option value="acre">{t('common.acre')}</option>
                <option value="hectare">{t('common.hectare')}</option>
                <option value="bigha">{t('common.bigha')}</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-primary-btn" disabled={is_saving}>
            {is_saving ? t('common.loading') : t('auth.onboarding_continue')}
          </button>
          <button type="button" className="btn btn-secondary auth-secondary-btn" onClick={handleSkip} disabled={is_saving}>
            {t('auth.onboarding_skip')}
          </button>
        </form>
      </div>

      <div className="auth-landscape" aria-hidden="true" />
    </div>
  );
}

export default OnboardingPage;
