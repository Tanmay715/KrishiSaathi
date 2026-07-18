import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { INDIAN_STATES } from '../config/indian_states';
import { useAuth } from '../hooks/useAuth';
import { getProfileOverview, updateProfile } from '../services/auth_service';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';

function formatMemberSince(value, locale) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return date.toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(name, phone) {
  if (name?.trim()) {
    return name.trim().charAt(0).toUpperCase();
  }

  return phone?.slice(-2) || '?';
}

function CapacityBar({ label, used, max_value }) {
  const share = max_value > 0 ? Math.min((used / max_value) * 100, 100) : 0;

  return (
    <div className="profile-capacity-row">
      <div className="profile-capacity-head">
        <span>{label}</span>
        <strong>{used} / {max_value}</strong>
      </div>
      <div className="profile-capacity-track">
        <div className="profile-capacity-fill" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [is_loading, setIsLoading] = useState(true);
  const [form, setForm] = useState({
    name: user?.name || '',
    preferred_language: user?.preferred_language || 'en',
    preferred_land_unit: user?.preferred_land_unit || 'acre',
    state_code: user?.state_code || '',
  });
  const [is_saving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [load_error, setLoadError] = useState('');

  useEffect(() => {
    loadOverview();
  }, []);

  async function loadOverview() {
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await getProfileOverview();
      const data = response.data;
      setOverview(data);
      setForm({
        name: data.user?.name || '',
        preferred_language: data.user?.preferred_language || 'en',
        preferred_land_unit: data.user?.preferred_land_unit || 'acre',
        state_code: data.user?.state_code || '',
      });
    } catch (error) {
      setLoadError(error.response?.data?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const response = await updateProfile(form);
      const token = localStorage.getItem('ks_token');
      login(response.data, token);
      i18n.changeLanguage(response.data.preferred_language);
      localStorage.setItem('ks_language', response.data.preferred_language);
      setMessage(t('profile.saved'));
      await loadOverview();
    } catch (error) {
      setMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (is_loading) {
    return <LoadingState />;
  }

  if (load_error && !overview) {
    return <ErrorState message={load_error} on_retry={loadOverview} />;
  }

  const profile_user = overview?.user || user;
  const stats = overview?.stats || {};
  const limits = overview?.limits || {};
  const net = Number(stats.net || 0);
  const state_label_key = i18n.language === 'hi' ? 'label_hi' : 'label_en';

  return (
    <div className="profile-page">
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <div className="profile-hero card">
        <div className="profile-avatar">{getInitials(profile_user?.name, profile_user?.phone)}</div>
        <div className="profile-hero-body">
          <h3>{profile_user?.name?.trim() || t('profile.default_name')}</h3>
          <p className="profile-phone">{profile_user?.phone}</p>
          <div className="profile-meta">
            <span>{t('profile.member_since', { date: formatMemberSince(profile_user?.created_at, i18n.language) })}</span>
            <span>{t(`common.${profile_user?.preferred_land_unit || 'acre'}`)}</span>
            <span>{profile_user?.preferred_language === 'hi' ? t('common.hindi') : t('common.english')}</span>
          </div>
        </div>
      </div>

      <div className="card-grid profile-stats-grid">
        <div className="card stat-card">
          <div className="stat-label">{t('dashboard.total_farms')}</div>
          <div className="stat-value">{limits.farms?.used || 0}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">{t('dashboard.total_plots')}</div>
          <div className="stat-value">{limits.plots?.used || 0}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">{t('profile.active_crops')}</div>
          <div className="stat-value">{stats.active_crops || 0}</div>
        </div>
        <div className="card stat-card stat-card-earn">
          <div className="stat-label">{t('profile.pending_sales')}</div>
          <div className="stat-value">{stats.pending_income_crops || 0}</div>
        </div>
      </div>

      <div className="card profile-finance-card">
        <div className="profile-section-head">
          <h3>{t('profile.farm_summary')}</h3>
          <Link to="/farms" className="btn btn-secondary btn-sm">{t('nav.farms')}</Link>
        </div>
        <div className="card-grid profile-finance-grid">
          <div className="profile-finance-item is-spent">
            <span>{t('dashboard.total_spent')}</span>
            <strong>₹{Number(stats.expense_total || 0).toLocaleString('en-IN')}</strong>
            <small>{t('profile.entry_count', { count: stats.expense_count || 0 })}</small>
          </div>
          <div className="profile-finance-item is-earned">
            <span>{t('dashboard.total_earned')}</span>
            <strong>₹{Number(stats.income_total || 0).toLocaleString('en-IN')}</strong>
            <small>{t('profile.entry_count', { count: stats.income_count || 0 })}</small>
          </div>
          <div className={`profile-finance-item ${net >= 0 ? 'is-profit' : 'is-loss'}`}>
            <span>{t('dashboard.net')}</span>
            <strong>{net >= 0 ? '+' : '-'}₹{Math.abs(net).toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      <div className="card profile-capacity-card">
        <h3>{t('profile.account_capacity')}</h3>
        <CapacityBar
          label={t('dashboard.total_farms')}
          used={limits.farms?.used || 0}
          max_value={limits.farms?.max || 0}
        />
        <CapacityBar
          label={t('dashboard.total_plots')}
          used={limits.plots?.used || 0}
          max_value={limits.plots?.max || 0}
        />
      </div>

      <div className="card profile-settings-card">
        <h3>{t('profile.settings')}</h3>
        {message && (
          <div className={`info-banner ${message === t('profile.saved') ? 'is-success' : 'is-error'}`}>
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.name_label')}</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('auth.language_label')}</label>
              <select
                className="form-select"
                value={form.preferred_language}
                onChange={(event) => setForm((prev) => ({ ...prev, preferred_language: event.target.value }))}
              >
                <option value="en">{t('common.english')}</option>
                <option value="hi">{t('common.hindi')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('auth.land_unit_label')}</label>
              <select
                className="form-select"
                value={form.preferred_land_unit}
                onChange={(event) => setForm((prev) => ({ ...prev, preferred_land_unit: event.target.value }))}
              >
                <option value="acre">{t('common.acre')}</option>
                <option value="hectare">{t('common.hectare')}</option>
                <option value="bigha">{t('common.bigha')}</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t('profile.state_label')}</label>
            <select
              className="form-select"
              value={form.state_code}
              onChange={(event) => setForm((prev) => ({ ...prev, state_code: event.target.value }))}
            >
              <option value="">{t('profile.state_placeholder')}</option>
              {INDIAN_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state[state_label_key]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={is_saving}>
            {is_saving ? t('common.loading') : t('profile.save_changes')}
          </button>
        </form>
      </div>

      <div className="card profile-logout-card">
        <button type="button" className="btn btn-danger" style={{ width: '100%' }} onClick={handleLogout}>
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;
