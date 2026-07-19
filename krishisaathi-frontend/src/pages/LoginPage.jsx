import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import OtpBoxes, { OTP_LENGTH } from '../components/OtpBoxes';
import api_client, { requestWithRetry } from '../services/api_client';
import { sendOtp, verifyOtp } from '../services/auth_service';
import { isValidIndianMobile, normalizeIndianMobile } from '../utils/phone_validation';
import { normalizeLanguage } from '../utils/language';

const RESEND_SECONDS = 30;
const SUCCESS_REDIRECT_SECONDS = 2;

function formatPhoneDisplay(phone) {
  const digits = String(phone || '');
  if (digits.length !== 10) {
    return digits;
  }
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, is_authenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [is_loading, setIsLoading] = useState(false);
  const [is_detecting, setIsDetecting] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [dev_otp, setDevOtp] = useState('');
  const [resend_left, setResendLeft] = useState(0);
  const [success_left, setSuccessLeft] = useState(SUCCESS_REDIRECT_SECONDS);
  const [needs_onboarding, setNeedsOnboarding] = useState(false);
  const verify_lock = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add('is-auth-screen');
    document.body.classList.add('is-auth-screen');
    return () => {
      document.documentElement.classList.remove('is-auth-screen');
      document.body.classList.remove('is-auth-screen');
    };
  }, []);

  useEffect(() => {
    if (is_authenticated && step === 'phone') {
      navigate(localStorage.getItem('ks_needs_onboarding') === '1' ? '/onboarding' : '/', {
        replace: true,
      });
    }
  }, [is_authenticated, navigate, step]);

  useEffect(() => {
    let is_active = true;

    async function warmApi() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await requestWithRetry(() => api_client.get('/health', { timeout: 25000 }), 1);
          return;
        } catch (_error) {
          if (!is_active) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    warmApi();
    return () => {
      is_active = false;
    };
  }, []);

  useEffect(() => {
    if (resend_left <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setResendLeft((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resend_left]);

  useEffect(() => {
    if (step !== 'success') {
      return undefined;
    }

    if (success_left <= 0) {
      navigate(needs_onboarding ? '/onboarding' : '/', { replace: true });
      return undefined;
    }

    const timer = window.setTimeout(() => setSuccessLeft((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [step, success_left, needs_onboarding, navigate]);

  function readErrorMessage(error) {
    return error.response?.data?.message
      || (error.code === 'ECONNABORTED' ? t('auth.slow_server') : null)
      || (!error.response ? t('auth.network_error') : t('common.error'));
  }

  async function requestOtp(raw_phone) {
    const normalized_phone = normalizeIndianMobile(raw_phone);

    if (!isValidIndianMobile(normalized_phone)) {
      setErrorMessage(t('auth.invalid_phone'));
      return false;
    }

    setPhone(normalized_phone);
    setIsLoading(true);
    setErrorMessage('');
    setDevOtp('');
    setOtp('');
    verify_lock.current = false;

    try {
      const response = await sendOtp(normalized_phone);
      const otp_code = response.data?.dev_otp || '';
      setDevOtp(otp_code);
      setResendLeft(RESEND_SECONDS);
      setStep('otp');
      setIsDetecting(Boolean(otp_code));
      if (otp_code) {
        window.setTimeout(() => setIsDetecting(false), 1800);
      }
      return true;
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendOtp(event) {
    event.preventDefault();
    await requestOtp(phone);
  }

  async function handleResend() {
    if (resend_left > 0 || is_loading) {
      return;
    }
    await requestOtp(phone);
  }

  const runVerify = useCallback(async (code) => {
    if (verify_lock.current || String(code || '').length !== OTP_LENGTH) {
      return;
    }

    verify_lock.current = true;
    setIsLoading(true);
    setErrorMessage('');
    setIsDetecting(false);

    try {
      const response = await verifyOtp({
        phone: normalizeIndianMobile(phone),
        otp: code,
      });

      const { user, token, is_new_user } = response.data;
      const next_lang = normalizeLanguage(user.preferred_language);
      i18n.changeLanguage(next_lang);
      localStorage.setItem('ks_language', next_lang);

      if (is_new_user) {
        localStorage.setItem('ks_needs_onboarding', '1');
        setNeedsOnboarding(true);
      } else {
        localStorage.removeItem('ks_needs_onboarding');
        setNeedsOnboarding(false);
      }

      setSuccessLeft(SUCCESS_REDIRECT_SECONDS);
      setStep('success');
      login(user, token);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
      setOtp('');
      verify_lock.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [phone, i18n, login, t]);

  function handleVerifySubmit(event) {
    event.preventDefault();
    runVerify(otp);
  }

  function handleOtpComplete(code) {
    runVerify(code);
  }

  const is_otp_complete = otp.length === OTP_LENGTH;

  return (
    <div className="auth-page is-premium">
      <header className="auth-brand-bar">
        <div className="auth-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M12 3c-2.8 3.2-4.2 6-4.2 8.4a4.2 4.2 0 108.4 0C16.2 9 14.8 6.2 12 3z"
              fill="currentColor"
            />
            <path d="M12 14v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="auth-brand-copy">
          <strong>{t('app.name')}</strong>
          <span>{t('app.tagline')}</span>
        </div>
      </header>

      <div className={`auth-card is-${step}`} key={step}>
        {step === 'phone' && (
          <>
            <div className="auth-card-icon is-phone" aria-hidden="true">
              <span>📱</span>
            </div>
            <h1>{t('auth.login_title')}</h1>
            <p className="subtitle">{t('auth.login_subtitle')}</p>

            {error_message && (
              <div className="error-banner auth-error">
                <div>{error_message}</div>
              </div>
            )}

            <form onSubmit={handleSendOtp} className="auth-form">
              <div className="form-group">
                <label htmlFor="phone">{t('auth.phone_label')}</label>
                <div className="auth-phone-field">
                  <span className="auth-phone-prefix">+91</span>
                  <input
                    id="phone"
                    className="form-input"
                    type="tel"
                    placeholder={t('auth.phone_placeholder')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <p className="auth-privacy-note">
                <span aria-hidden="true">🛡</span>
                {t('auth.privacy_note')}
              </p>

              <button
                type="submit"
                className="btn btn-primary auth-primary-btn"
                disabled={is_loading || phone.length !== 10}
              >
                {is_loading ? (
                  <span className="auth-btn-loading">{t('common.loading')}</span>
                ) : (
                  <>
                    {t('auth.send_otp')}
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <div className="auth-card-icon is-shield" aria-hidden="true">
              <span>✓</span>
            </div>
            <h1>{t('auth.verify_title')}</h1>
            <p className="subtitle">
              {t('auth.otp_sent_to')}
              {' '}
              <strong className="auth-phone-highlight">+91 {formatPhoneDisplay(phone)}</strong>
            </p>

            <div className="auth-pill-row">
              <button
                type="button"
                className="auth-pill-btn"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setErrorMessage('');
                  verify_lock.current = false;
                }}
              >
                {t('auth.change_number')}
              </button>
              <button
                type="button"
                className="auth-pill-btn"
                onClick={handleResend}
                disabled={resend_left > 0 || is_loading}
              >
                {resend_left > 0
                  ? t('auth.resend_in', { seconds: resend_left })
                  : t('auth.resend_otp')}
              </button>
            </div>

            {dev_otp && (
              <div className="auth-pilot-banner">
                <span className="auth-pilot-badge">{t('auth.pilot_badge')}</span>
                <p>{t('auth.pilot_mode_body')}</p>
                <strong className="auth-pilot-code">{dev_otp}</strong>
              </div>
            )}

            {error_message && (
              <div className="error-banner auth-error">
                <div>{error_message}</div>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} className="auth-form">
              <div className="form-group">
                <label>{t('auth.otp_boxes_label')}</label>
                <OtpBoxes
                  value={otp}
                  on_change={setOtp}
                  on_complete={handleOtpComplete}
                  disabled={is_loading}
                />
              </div>

              {is_detecting && (
                <p className="auth-detecting">
                  <span className="auth-spinner" aria-hidden="true" />
                  {t('auth.auto_detecting')}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary auth-primary-btn"
                disabled={!is_otp_complete || is_loading}
              >
                {is_loading ? (
                  <span className="auth-btn-loading">{t('auth.verifying')}</span>
                ) : (
                  <>
                    {t('auth.verify_otp')}
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>

            <p className="auth-help-link">{t('auth.trouble_hint')}</p>
          </>
        )}

        {step === 'success' && (
          <div className="auth-success">
            <div className="auth-card-icon is-success" aria-hidden="true">
              <span>✓</span>
            </div>
            <h1>{t('auth.success_title')}</h1>
            <p className="subtitle">
              {t(needs_onboarding ? 'auth.success_body' : 'auth.success_body_returning', {
                app: t('app.name'),
              })}
            </p>
            <div className="auth-redirect-banner">
              <span aria-hidden="true">🌿</span>
              <div>
                <strong>{t('auth.redirecting_title')}</strong>
                <p>{t('auth.redirecting_in', { seconds: success_left })}</p>
              </div>
            </div>
            <div className="auth-sprout" aria-hidden="true">🌱</div>
          </div>
        )}
      </div>

      {step === 'phone' && (
        <p className="auth-legal">
          <Link to="/login">{t('auth.terms')}</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/login">{t('auth.privacy')}</Link>
        </p>
      )}

      <div className="auth-landscape" aria-hidden="true" />
    </div>
  );
}

export default LoginPage;
