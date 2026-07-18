import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import api_client from '../services/api_client';
import { sendOtp, verifyOtp } from '../services/auth_service';
import { isValidIndianMobile, normalizeIndianMobile } from '../utils/phone_validation';

function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [preferred_language, setPreferredLanguage] = useState(i18n.language);
  const [preferred_land_unit, setPreferredLandUnit] = useState('acre');
  const [is_loading, setIsLoading] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [dev_otp, setDevOtp] = useState('');
  const [is_server_ready, setIsServerReady] = useState(true);

  useEffect(() => {
    let is_active = true;

    async function wakeServer() {
      try {
        await api_client.get('/health', { timeout: 20000 });
        if (is_active) {
          setIsServerReady(true);
        }
      } catch (_error) {
        if (is_active) {
          setIsServerReady(false);
        }
      }
    }

    wakeServer();
    return () => {
      is_active = false;
    };
  }, []);

  async function handleSendOtp(event) {
    event.preventDefault();

    const normalized_phone = normalizeIndianMobile(phone);

    if (!isValidIndianMobile(normalized_phone)) {
      setErrorMessage(t('auth.invalid_phone'));
      return;
    }

    setPhone(normalized_phone);
    setIsLoading(true);
    setErrorMessage('');
    setDevOtp('');

    try {
      const response = await sendOtp(normalized_phone);
      const otp_code = response.data?.dev_otp || '';
      setDevOtp(otp_code);
      if (otp_code) {
        setOtp(otp_code);
      }
      setStep('otp');
    } catch (error) {
      const api_message = error.response?.data?.message;
      const is_network = !error.response;
      setErrorMessage(
        api_message
          || (is_network ? t('auth.network_error') : t('common.error')),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await verifyOtp({
        phone: normalizeIndianMobile(phone),
        otp,
        name: name || undefined,
        preferred_language,
        preferred_land_unit,
      });

      const { user, token } = response.data;
      i18n.changeLanguage(user.preferred_language);
      localStorage.setItem('ks_language', user.preferred_language);
      login(user, token);
      navigate('/');
    } catch (error) {
      const api_message = error.response?.data?.message;
      const is_network = !error.response;
      setErrorMessage(
        api_message
          || (is_network ? t('auth.network_error') : t('common.error')),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t('auth.login_title')}</h1>
        <p className="subtitle">{t('auth.login_subtitle')}</p>

        {error_message && <div className="error-banner">{error_message}</div>}
        {!is_server_ready && !error_message && (
          <div className="error-banner" style={{ background: '#fff4e5', color: '#8a5a00' }}>
            {t('auth.server_waking')}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label htmlFor="phone">{t('auth.phone_label')}</label>
              <input
                id="phone"
                className="form-input"
                type="tel"
                placeholder={t('auth.phone_placeholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
                autoComplete="tel"
                required
              />
            </div>
            <div className="auth-submit-bar">
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={is_loading}>
                {is_loading ? t('common.loading') : t('auth.send_otp')}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              {t('auth.otp_sent')} +91 {phone}
            </p>
            <div className="action-row" style={{ marginBottom: 16 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep('phone')}>
                {t('auth.change_number')}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleSendOtp} disabled={is_loading}>
                {is_loading ? t('common.loading') : t('auth.resend_otp')}
              </button>
            </div>

            {dev_otp && (
              <div
                className="error-banner"
                style={{ background: '#e8f4ec', color: 'var(--color-primary-dark)', marginBottom: 16 }}
              >
                <div style={{ marginBottom: 6 }}>{t('auth.dev_otp_hint')}</div>
                <strong style={{ fontSize: '1.25rem', letterSpacing: '0.2em' }}>{dev_otp}</strong>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="otp">{t('auth.otp_label')}</label>
              <input
                id="otp"
                className="form-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">{t('auth.name_label')}</label>
              <input id="name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="language">{t('auth.language_label')}</label>
                <select
                  id="language"
                  className="form-select"
                  value={preferred_language}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                >
                  <option value="en">{t('common.english')}</option>
                  <option value="hi">{t('common.hindi')}</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="land_unit">{t('auth.land_unit_label')}</label>
                <select
                  id="land_unit"
                  className="form-select"
                  value={preferred_land_unit}
                  onChange={(e) => setPreferredLandUnit(e.target.value)}
                >
                  <option value="acre">{t('common.acre')}</option>
                  <option value="hectare">{t('common.hectare')}</option>
                  <option value="bigha">{t('common.bigha')}</option>
                </select>
              </div>
            </div>

            <div className="auth-submit-bar">
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={is_loading}>
                {is_loading ? t('common.loading') : t('auth.verify_otp')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
