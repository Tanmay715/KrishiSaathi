import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PendingIncomeSection from '../components/PendingIncomeSection';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import MandiMarketSection from '../components/MandiMarketSection';
import Modal from '../components/Modal';
import SectionIcon from '../components/SectionIcon';
import WeatherScene from '../components/illustrations/WeatherScene';
import {
  createReminder,
  generateReminders,
  getExpenseSummary,
  getFarms,
  getIncomeSummary,
  getPendingIncomeCrops,
  getReminders,
  getWeather,
  updateReminder,
} from '../services/farm_service';
import { CACHE_KEYS, consumeLocationUpdated, loadOfflineData, saveOfflineData } from '../utils/offline_store';
import { weatherMood } from '../utils/field_identity';
import { normalizeLanguage } from '../utils/language';

const REMINDER_TYPES = ['irrigation', 'fertilizer', 'pesticide', 'harvest', 'weather', 'custom'];

const QUICK_ACTIONS = [
  { to: '/money?add=expense', icon: 'expense', label_key: 'dashboard.quick_expense', tone: 'warn' },
  { to: '/money?add=income', icon: 'income', label_key: 'dashboard.quick_income', tone: 'success' },
  { to: '/farms', icon: 'crop', label_key: 'dashboard.quick_farms', tone: 'accent' },
  { to: '/assistant', icon: 'crop', label_key: 'dashboard.quick_advice', tone: 'success' },
  { to: '/market', icon: 'mandi', label_key: 'dashboard.quick_mandi', tone: 'accent' },
  { to: '#reminders', icon: 'history', label_key: 'dashboard.quick_reminder', tone: 'default', is_reminder: true },
];

function formatReminderDate(value, language) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleDateString(normalizeLanguage(language) === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [farms, setFarms] = useState([]);
  const [expense_summary, setExpenseSummary] = useState({ total_spent: 0, expense_count: 0 });
  const [income_summary, setIncomeSummary] = useState({ total_earned: 0, income_count: 0 });
  const [weather, setWeather] = useState(null);
  const [pending_income_crops, setPendingIncomeCrops] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [is_loading, setIsLoading] = useState(true);
  const [is_cached_view, setIsCachedView] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [is_working, setIsWorking] = useState(false);
  const [show_reminder_modal, setShowReminderModal] = useState(false);
  const [show_all_reminders, setShowAllReminders] = useState(false);
  const [reminder_form, setReminderForm] = useState({
    title: '',
    type: 'custom',
    due_at: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (consumeLocationUpdated()) {
      refreshWeather();
    }
  }, []);

  async function refreshWeather() {
    try {
      const weather_response = await getWeather();
      setWeather(weather_response.data || null);
      const cached = loadOfflineData(CACHE_KEYS.dashboard);
      if (cached) {
        saveOfflineData(CACHE_KEYS.dashboard, {
          ...cached,
          weather: weather_response.data || null,
        });
      }
      setIsCachedView(false);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadDashboard() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [
        farms_response,
        expense_response,
        income_response,
        pending_response,
        reminders_response,
      ] = await Promise.all([
        getFarms(),
        getExpenseSummary(),
        getIncomeSummary(),
        getPendingIncomeCrops(),
        getReminders({ status: 'pending' }),
      ]);

      let weather_data = null;
      try {
        const weather_response = await getWeather();
        weather_data = weather_response.data || null;
      } catch (weather_error) {
        console.error(weather_error);
        const cached = loadOfflineData(CACHE_KEYS.dashboard);
        weather_data = cached?.weather || null;
      }

      const dashboard_data = {
        farms: farms_response.data || [],
        expense_summary: expense_response.data || { total_spent: 0, expense_count: 0 },
        income_summary: income_response.data || { total_earned: 0, income_count: 0 },
        weather: weather_data,
        pending_income_crops: pending_response.data || [],
        reminders: reminders_response.data || [],
      };

      setFarms(dashboard_data.farms);
      setExpenseSummary(dashboard_data.expense_summary);
      setIncomeSummary(dashboard_data.income_summary);
      setWeather(dashboard_data.weather);
      setPendingIncomeCrops(dashboard_data.pending_income_crops);
      setReminders(dashboard_data.reminders);
      setIsCachedView(false);
      saveOfflineData(CACHE_KEYS.dashboard, dashboard_data);
    } catch (error) {
      console.error(error);
      const cached = loadOfflineData(CACHE_KEYS.dashboard);
      if (cached) {
        setFarms(cached.farms || []);
        setExpenseSummary(cached.expense_summary || { total_spent: 0 });
        setIncomeSummary(cached.income_summary || { total_earned: 0 });
        setWeather(cached.weather || null);
        setPendingIncomeCrops(cached.pending_income_crops || []);
        setReminders(cached.reminders || []);
        setIsCachedView(true);
      } else {
        setErrorMessage(error.response?.data?.message || t('common.error'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReminderStatus(reminder_id, status) {
    try {
      await updateReminder(reminder_id, { status });
      setReminders((prev) => prev.filter((item) => item.id !== reminder_id));
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    }
  }

  async function handleGenerateReminders() {
    setIsWorking(true);
    try {
      const response = await generateReminders();
      setReminders(response.data || []);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateReminder(event) {
    event.preventDefault();
    setIsWorking(true);
    try {
      await createReminder({
        type: reminder_form.type,
        title: reminder_form.title,
        due_at: new Date(`${reminder_form.due_at}T09:00:00`).toISOString(),
      });
      setShowReminderModal(false);
      setReminderForm({
        title: '',
        type: 'custom',
        due_at: new Date().toISOString().slice(0, 10),
      });
      const response = await getReminders({ status: 'pending' });
      setReminders(response.data || []);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsWorking(false);
    }
  }

  const total_spent = Number(expense_summary.total_spent || 0);
  const total_earned = Number(income_summary.total_earned || 0);
  const net = total_earned - total_spent;
  const expense_count = Number(expense_summary.expense_count || 0);
  const income_count = Number(income_summary.income_count || 0);
  const language = i18n.resolvedLanguage || i18n.language;

  const sorted_reminders = useMemo(() => (
    [...reminders].sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
  ), [reminders]);

  const preview_reminders = show_all_reminders
    ? sorted_reminders
    : sorted_reminders.slice(0, 2);
  const has_hidden_reminders = sorted_reminders.length > 2;
  const weather_location = [weather?.location?.name, weather?.location?.region]
    .filter(Boolean)
    .join(', ');
  const temp = weather?.current?.temperature_c != null
    ? Math.round(weather.current.temperature_c)
    : null;
  const forecast_day = weather?.forecast?.[0] || null;
  const weather_mood = weatherMood(weather);

  if (is_loading) {
    return <LoadingState />;
  }

  if (error_message && farms.length === 0 && !weather) {
    return <ErrorState message={error_message} on_retry={loadDashboard} />;
  }

  return (
    <div className="dashboard-page page-stack is-home">
      {is_cached_view && (
        <div className="info-banner">{t('pwa.cached_data')}</div>
      )}

      {error_message && (
        <div className="error-banner">{error_message}</div>
      )}

      {farms.length === 0 ? (
        <EmptyState
          title={t('dashboard.get_started')}
          message={t('dashboard.empty_hint')}
          action={(
            <Link to="/farms?add=1" className="btn btn-primary" style={{ marginTop: 12 }}>
              {t('farms.add_farm')}
            </Link>
          )}
        />
      ) : (
        <>
          <section className={`home-weather-card has-scene mood-${weather_mood}`}>
            <WeatherScene mood={weather_mood} className="home-weather-scene" />
            <div className="home-weather-copy">
              {weather_location && (
                <p className="home-weather-place">{weather_location}</p>
              )}
              <div className="home-weather-main">
                <strong>{temp != null ? `${temp}°C` : '—'}</strong>
                <span>{weather?.current?.condition || t('weather.title')}</span>
              </div>
              {forecast_day && (
                <p className="home-weather-range">
                  Min {Math.round(forecast_day.temp_min)}° | Max {Math.round(forecast_day.temp_max)}°
                </p>
              )}
            </div>
          </section>

          <section className="home-section">
            <h3 className="home-section-title">{t('dashboard.today_summary')}</h3>
            <div className="home-summary-row">
              <div className="home-summary-card tone-spent">
                <SectionIcon name="expense" tone="warn" />
                <span>{t('dashboard.total_spent')}</span>
                <strong>₹{total_spent.toLocaleString('en-IN')}</strong>
                <small>{t('profile.entry_count', { count: expense_count })}</small>
              </div>
              <div className="home-summary-card tone-earned">
                <SectionIcon name="income" tone="success" />
                <span>{t('dashboard.total_earned')}</span>
                <strong>₹{total_earned.toLocaleString('en-IN')}</strong>
                <small>{t('profile.entry_count', { count: income_count })}</small>
              </div>
              <Link to="/money" className="home-summary-card tone-profit">
                <SectionIcon name="mandi" tone="accent" />
                <span>{t('dashboard.total_profit')}</span>
                <strong>{net >= 0 ? '+' : '-'}₹{Math.abs(net).toLocaleString('en-IN')}</strong>
                <small>{t('dashboard.from_farm')}</small>
              </Link>
            </div>
          </section>

          <MandiMarketSection
            farm_id={farms[0]?.id || null}
            preferred_crops={pending_income_crops.map((crop) => crop.crop_name || crop.name)}
          />

          <section className="home-split">
            <div className="home-quick">
              <h3 className="home-section-title">{t('dashboard.quick_do')}</h3>
              <div className="home-quick-grid">
                {QUICK_ACTIONS.map((action) => (
                  action.is_reminder ? (
                    <button
                      key={action.label_key}
                      type="button"
                      className="home-quick-tile"
                      onClick={() => setShowReminderModal(true)}
                    >
                      <SectionIcon name={action.icon} tone={action.tone} />
                      <span>{t(action.label_key)}</span>
                    </button>
                  ) : (
                    <Link key={action.label_key} to={action.to} className="home-quick-tile">
                      <SectionIcon name={action.icon} tone={action.tone} />
                      <span>{t(action.label_key)}</span>
                    </Link>
                  )
                ))}
              </div>
            </div>

            <Link to="/assistant" className="home-assistant-card">
              <div>
                <strong>{t('assistant.title')}</strong>
                <p>{t('assistant.cta')}</p>
              </div>
              <span className="home-assistant-btn">{t('dashboard.chat_now')} →</span>
            </Link>
          </section>

          {pending_income_crops.length > 0 && (
            <PendingIncomeSection crops={pending_income_crops} show_location />
          )}

          <section className="home-section" id="reminders">
            <div className="home-section-head">
              <h3 className="home-section-title">{t('reminders.title')}</h3>
              {has_hidden_reminders && (
                <button
                  type="button"
                  className="home-section-link"
                  onClick={() => setShowAllReminders((prev) => !prev)}
                >
                  {show_all_reminders
                    ? t('common.show_less')
                    : `${t('reminders.view_all', { count: sorted_reminders.length })} →`}
                </button>
              )}
            </div>

            <div className="home-reminder-card">
              {preview_reminders.length > 0 ? (
                <ul className="home-reminder-list">
                  {preview_reminders.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {t(`reminders.types.${item.type}`)}
                          {' · '}
                          {formatReminderDate(item.due_at, language)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="home-reminder-done"
                        onClick={() => handleReminderStatus(item.id, 'done')}
                      >
                        ✓
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="home-reminder-empty">{t('reminders.empty_calm')}</p>
              )}

              <div className="home-reminder-actions">
                <button type="button" className="home-section-link" onClick={() => setShowReminderModal(true)}>
                  + {t('reminders.add')}
                </button>
                <button
                  type="button"
                  className="home-section-link is-muted"
                  disabled={is_working}
                  onClick={handleGenerateReminders}
                >
                  {t('reminders.generate')}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {show_reminder_modal && (
        <Modal
          title={t('reminders.add')}
          on_close={() => setShowReminderModal(false)}
          variant="sheet"
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" form="reminder-form" className="btn btn-primary" disabled={is_working}>
                {is_working ? t('common.loading') : t('reminders.add')}
              </button>
            </div>
          )}
        >
          <form id="reminder-form" className="form-compact" onSubmit={handleCreateReminder}>
            <div className="form-group">
              <label>{t('reminders.reminder_title')}</label>
              <input
                className="form-input"
                value={reminder_form.title}
                onChange={(e) => setReminderForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('reminders.type')}</label>
                <select
                  className="form-select"
                  value={reminder_form.type}
                  onChange={(e) => setReminderForm((prev) => ({ ...prev, type: e.target.value }))}
                >
                  {REMINDER_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`reminders.types.${type}`)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('reminders.due_at')}</label>
                <input
                  className="form-input"
                  type="date"
                  value={reminder_form.due_at}
                  onChange={(e) => setReminderForm((prev) => ({ ...prev, due_at: e.target.value }))}
                  required
                />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default DashboardPage;
