import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import PendingIncomeSection from '../components/PendingIncomeSection';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';
import MoneyFlowChart from '../components/MoneyFlowChart';
import RemindersPanel from '../components/RemindersPanel';
import MandiPricePanel from '../components/MandiPricePanel';
import TodayRecommendations from '../components/TodayRecommendations';
import StatCard from '../components/StatCard';
import {
  getExpenseSummary,
  getFarms,
  getIncomeSummary,
  getPendingIncomeCrops,
  getReminders,
  getWeather,
} from '../services/farm_service';
import { CACHE_KEYS, loadOfflineData, saveOfflineData } from '../utils/offline_store';
import { buildTodayRecommendations, buildWeatherAdvice } from '../utils/dashboard_insights';

function formatForecastDate(iso_date, language) {
  const date = new Date(`${iso_date}T00:00:00`);
  return date.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function DashboardPage() {
  const { t, i18n } = useTranslation();
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

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [
        farms_response,
        expense_response,
        income_response,
        weather_response,
        pending_response,
        reminders_response,
      ] = await Promise.all([
        getFarms(),
        getExpenseSummary(),
        getIncomeSummary(),
        getWeather(),
        getPendingIncomeCrops(),
        getReminders({ status: 'pending' }),
      ]);

      const dashboard_data = {
        farms: farms_response.data || [],
        expense_summary: expense_response.data || { total_spent: 0 },
        income_summary: income_response.data || { total_earned: 0 },
        weather: weather_response.data || null,
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

  const total_plots = farms.reduce((sum, farm) => sum + (farm.plot_count || 0), 0);
  const total_spent = Number(expense_summary.total_spent || 0);
  const total_earned = Number(income_summary.total_earned || 0);
  const net = total_earned - total_spent;

  const recommendations = useMemo(
    () => buildTodayRecommendations({
      t,
      weather,
      pending_income_crops,
      reminders,
      net,
      farms_count: farms.length,
    }),
    [t, weather, pending_income_crops, reminders, net, farms.length],
  );

  const weather_advice = useMemo(
    () => buildWeatherAdvice(t, weather),
    [t, weather],
  );

  if (is_loading) {
    return <LoadingState />;
  }

  if (error_message) {
    return <ErrorState message={error_message} on_retry={loadDashboard} />;
  }

  return (
    <div className="dashboard-page page-stack">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={`${t('dashboard.welcome')}${user?.name ? `, ${user.name}` : ''}`}
      />

      {is_cached_view && (
        <div className="info-banner">{t('pwa.cached_data')}</div>
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
          {weather && (
            <div className="card weather-strip fade-in">
              <div className="weather-main">
                <div>
                  <div className="stat-label">{t('weather.title')}</div>
                  <strong className="weather-temp">
                    {weather.current?.temperature_c != null
                      ? `${Math.round(weather.current.temperature_c)}°C`
                      : '—'}
                  </strong>
                  <span className="weather-condition">{weather.current?.condition}</span>
                </div>
                <div className="weather-meta">
                  <span>
                    {weather.location?.name}
                    {weather.location?.region ? `, ${weather.location.region}` : ''}
                  </span>
                  <span>
                    {t('weather.rain_chance')}: {weather.current?.rain_chance ?? 0}%
                  </span>
                </div>
              </div>
              {weather_advice.length > 0 && (
                <ul className="weather-advice-list">
                  {weather_advice.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              )}
              {weather.forecast?.length > 0 && (
                <div className="weather-forecast">
                  {weather.forecast.map((day) => (
                    <div key={day.date} className="weather-day">
                      <strong>{formatForecastDate(day.date, i18n.language)}</strong>
                      <span>
                        {Math.round(day.temp_max)}° / {Math.round(day.temp_min)}°
                      </span>
                      <span>{day.rain_chance}% {t('weather.rain')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <TodayRecommendations items={recommendations} />

          <section className="card active-crop-summary fade-in">
            <div className="section-head-row">
              <div>
                <h3>{t('dashboard.active_crop_summary')}</h3>
                <p>{t('dashboard.active_crop_summary_hint')}</p>
              </div>
              <Link to="/farms" className="btn btn-secondary btn-sm">{t('nav.farms')}</Link>
            </div>
            <div className="summary-chip-row">
              <span className="summary-chip">🌾 {t('dashboard.total_farms')}: {farms.length}</span>
              <span className="summary-chip">📍 {t('dashboard.total_plots')}: {total_plots}</span>
              <span className="summary-chip">
                ⏳ {t('profile.pending_sales')}: {pending_income_crops.length}
              </span>
              <span className={`summary-chip ${net >= 0 ? 'is-profit-chip' : 'is-loss-chip'}`}>
                📈 {net >= 0 ? t('finance.profit') : t('finance.loss')}: {net >= 0 ? '+' : '-'}₹
                {Math.abs(net).toLocaleString('en-IN')}
              </span>
            </div>
          </section>

          <RemindersPanel compact default_open />

          <div className="card quick-log-cta no-print fade-in">
            <div>
              <h3 style={{ margin: '0 0 4px' }}>{t('quick_log.title')}</h3>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                {t('quick_log.dashboard_hint')}
              </p>
            </div>
            <p className="section-note" style={{ margin: 0 }}>{t('quick_log.fab_hint')}</p>
          </div>

          <section className="card pl-summary fade-in">
            <h3 className="pl-summary-title">{t('dashboard.farm_pl')}</h3>
            <div className="pl-summary-grid">
              <div className="pl-item is-earned">
                <span>{t('dashboard.total_earned')}</span>
                <strong>₹{total_earned.toLocaleString('en-IN')}</strong>
              </div>
              <div className="pl-item is-spent">
                <span>{t('dashboard.total_spent')}</span>
                <strong>₹{total_spent.toLocaleString('en-IN')}</strong>
              </div>
              <div className={`pl-item ${net >= 0 ? 'is-profit' : 'is-loss'}`}>
                <span>{net >= 0 ? t('finance.status_profit') : t('finance.status_loss')}</span>
                <strong>
                  {net >= 0 ? '+' : '-'}₹{Math.abs(net).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
            {pending_income_crops.length > 0 && (
              <p className="pl-pending-note">
                {t('dashboard.pending_income_note', { count: pending_income_crops.length })}
              </p>
            )}
          </section>

          <PendingIncomeSection crops={pending_income_crops} show_location />

          <MandiPricePanel
            farm_id={farms[0]?.id || null}
            crop_options={['Wheat', 'Rice', 'Cotton', 'Mustard', 'Potato', 'Moong', 'Chana', 'Onion', 'Tomato']}
          />

          <div className="card assistant-cta fade-in">
            <div>
              <h3 style={{ margin: '0 0 4px' }}>{t('assistant.title')}</h3>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                {t('assistant.cta')}
              </p>
            </div>
            <Link to="/assistant" className="btn btn-primary">
              {t('assistant.open')}
            </Link>
          </div>

          <div className="card-grid stats-grid-compact">
            <StatCard icon="🌾" label={t('dashboard.total_farms')} value={farms.length} tone="farms" />
            <StatCard icon="📍" label={t('dashboard.total_plots')} value={total_plots} tone="plots" />
            <StatCard
              icon="💰"
              label={t('dashboard.total_earned')}
              value={`₹${total_earned.toLocaleString('en-IN')}`}
              tone="income"
            />
            <StatCard
              icon="📉"
              label={t('dashboard.total_spent')}
              value={`₹${total_spent.toLocaleString('en-IN')}`}
              tone="expense"
            />
            <StatCard
              icon="📈"
              label={net >= 0 ? t('finance.profit') : t('finance.loss')}
              value={`${net >= 0 ? '+' : '-'}₹${Math.abs(net).toLocaleString('en-IN')}`}
              tone={net >= 0 ? 'profit' : 'loss'}
            />
          </div>

          <div className="card analytics-card fade-in">
            <h3 className="analytics-card-title">{t('analytics.spend_vs_earn')}</h3>
            <MoneyFlowChart
              spent={total_spent}
              earned={total_earned}
              empty_label={t('analytics.no_money_data')}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;
