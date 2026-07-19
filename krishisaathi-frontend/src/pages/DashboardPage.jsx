import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import PendingIncomeSection from '../components/PendingIncomeSection';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import TodayFieldScene from '../components/TodayFieldScene';
import PulseRail from '../components/PulseRail';
import MandiMarketSection from '../components/MandiMarketSection';
import Modal from '../components/Modal';
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
import { buildTodayRecommendations } from '../utils/dashboard_insights';
import { farmHealthScore } from '../utils/field_identity';

const REMINDER_TYPES = ['irrigation', 'fertilizer', 'pesticide', 'harvest', 'weather', 'custom'];

function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [farms, setFarms] = useState([]);
  const [expense_summary, setExpenseSummary] = useState({ total_spent: 0 });
  const [income_summary, setIncomeSummary] = useState({ total_earned: 0 });
  const [weather, setWeather] = useState(null);
  const [pending_income_crops, setPendingIncomeCrops] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [is_loading, setIsLoading] = useState(true);
  const [is_cached_view, setIsCachedView] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [is_working, setIsWorking] = useState(false);
  const [show_reminder_modal, setShowReminderModal] = useState(false);
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
        expense_summary: expense_response.data || { total_spent: 0 },
        income_summary: income_response.data || { total_earned: 0 },
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

  const total_plots = farms.reduce((sum, farm) => sum + (farm.plot_count || 0), 0);
  const total_spent = Number(expense_summary.total_spent || 0);
  const total_earned = Number(income_summary.total_earned || 0);
  const net = total_earned - total_spent;

  const recommendations = useMemo(
    () => buildTodayRecommendations({
      t,
      weather,
      pending_income_crops,
      net,
      farms_count: farms.length,
    }),
    [t, weather, pending_income_crops, net, farms.length],
  );

  const sorted_reminders = useMemo(() => (
    [...reminders].sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
  ), [reminders]);

  const health = useMemo(() => farmHealthScore({
    earned: total_earned,
    spent: total_spent,
    pending_count: pending_income_crops.length,
    reminders: sorted_reminders,
  }), [total_earned, total_spent, pending_income_crops.length, sorted_reminders]);

  const primary_action = recommendations[0] || null;
  const greeting = `${t('dashboard.welcome')}${user?.name ? `, ${user.name}` : ''}`;

  if (is_loading) {
    return <LoadingState />;
  }

  if (error_message && farms.length === 0 && !weather) {
    return <ErrorState message={error_message} on_retry={loadDashboard} />;
  }

  return (
    <div className="dashboard-page page-stack is-field">
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
          <TodayFieldScene
            weather={weather}
            primary_action={primary_action}
            greeting={greeting}
            health={health}
            farms_count={farms.length}
            plots_count={total_plots}
            earned={total_earned}
            spent={total_spent}
            net={net}
          />

          <PulseRail
            reminders={sorted_reminders}
            is_working={is_working}
            on_reminder_done={(id) => handleReminderStatus(id, 'done')}
            on_reminder_dismiss={(id) => handleReminderStatus(id, 'dismissed')}
            on_add_reminder={() => setShowReminderModal(true)}
            on_generate_reminders={handleGenerateReminders}
          />

          {pending_income_crops.length > 0 && (
            <PendingIncomeSection crops={pending_income_crops} show_location />
          )}

          <MandiMarketSection
            farm_id={farms[0]?.id || null}
            preferred_crops={pending_income_crops.map((crop) => crop.crop_name || crop.name)}
          />

          <Link to="/assistant" className="assistant-strip is-field is-quiet">
            <div>
              <strong>{t('assistant.title')}</strong>
              <span>{t('assistant.cta')}</span>
            </div>
            <span className="assistant-strip-arrow" aria-hidden="true">→</span>
          </Link>
        </>
      )}

      {show_reminder_modal && (
        <Modal title={t('reminders.add')} on_close={() => setShowReminderModal(false)}>
          <form onSubmit={handleCreateReminder}>
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
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={is_working}>
                {is_working ? t('common.loading') : t('reminders.add')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default DashboardPage;
