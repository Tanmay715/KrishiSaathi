import { useEffect, useState } from 'react';
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
import { getExpenseSummary, getFarms, getIncomeSummary, getPendingIncomeCrops, getWeather } from '../services/farm_service';
import { CACHE_KEYS, loadOfflineData, saveOfflineData } from '../utils/offline_store';

function formatForecastDate(iso_date) {
  const date = new Date(`${iso_date}T00:00:00`);
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11
    ? 'st'
    : day % 10 === 2 && day !== 12
      ? 'nd'
      : day % 10 === 3 && day !== 13
        ? 'rd'
        : 'th';
  const month = date.toLocaleString('en-IN', { month: 'long' });
  return `${day}${suffix} ${month} ${date.getFullYear()}`;
}

function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [farms, setFarms] = useState([]);
  const [expense_summary, setExpenseSummary] = useState({ total_spent: 0 });
  const [income_summary, setIncomeSummary] = useState({ total_earned: 0 });
  const [weather, setWeather] = useState(null);
  const [pending_income_crops, setPendingIncomeCrops] = useState([]);
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
      const [farms_response, expense_response, income_response, weather_response, pending_response] =
        await Promise.all([
          getFarms(),
          getExpenseSummary(),
          getIncomeSummary(),
          getWeather(),
          getPendingIncomeCrops(),
        ]);
      const dashboard_data = {
        farms: farms_response.data || [],
        expense_summary: expense_response.data || { total_spent: 0 },
        income_summary: income_response.data || { total_earned: 0 },
        weather: weather_response.data || null,
        pending_income_crops: pending_response.data || [],
      };

      setFarms(dashboard_data.farms);
      setExpenseSummary(dashboard_data.expense_summary);
      setIncomeSummary(dashboard_data.income_summary);
      setWeather(dashboard_data.weather);
      setPendingIncomeCrops(dashboard_data.pending_income_crops);
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

  if (is_loading) {
    return <LoadingState />;
  }

  if (error_message) {
    return <ErrorState message={error_message} on_retry={loadDashboard} />;
  }

  return (
    <div>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={`${t('dashboard.welcome')}${user?.name ? `, ${user.name}` : ''}`}
      />

      {is_cached_view && (
        <div className="info-banner">{t('pwa.cached_data')}</div>
      )}

      {farms.length === 0 ? (
        <EmptyState
          message={t('dashboard.get_started')}
          action={(
            <Link to="/farms" className="btn btn-primary" style={{ marginTop: 16 }}>
              {t('farms.add_farm')}
            </Link>
          )}
        />
      ) : (
        <>
      {weather && (
        <div className="card weather-strip">
          <div className="weather-main">
            <div>
              <div className="stat-label">{t('weather.title')}</div>
              <strong className="weather-temp">
                {weather.current?.temperature_c != null ? `${Math.round(weather.current.temperature_c)}°C` : '—'}
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
          <p className="weather-advisory">{weather.advisory}</p>
          {weather.forecast?.length > 0 && (
            <div className="weather-forecast">
              {weather.forecast.map((day) => (
                <div key={day.date} className="weather-day">
                  <strong>{formatForecastDate(day.date)}</strong>
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

      <div className="card quick-log-cta no-print">
        <div>
          <h3 style={{ margin: '0 0 6px' }}>{t('quick_log.title')}</h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t('quick_log.dashboard_hint')}</p>
        </div>
        <p className="section-note">{t('quick_log.fab_hint')}</p>
      </div>

      <PendingIncomeSection crops={pending_income_crops} show_location />

      <MandiPricePanel
        farm_id={farms[0]?.id || null}
        crop_options={['Wheat', 'Rice', 'Cotton', 'Mustard', 'Potato', 'Moong', 'Chana', 'Onion', 'Tomato']}
      />

      <RemindersPanel compact />

      <div className="card assistant-cta">
        <div>
          <h3 style={{ margin: '0 0 6px' }}>{t('assistant.title')}</h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t('assistant.cta')}</p>
        </div>
        <Link to="/assistant" className="btn btn-primary">
          {t('assistant.open')}
        </Link>
      </div>

      <div className="card-grid">
        <div className="card stat-card">
          <div className="stat-label">{t('dashboard.total_farms')}</div>
          <div className="stat-value">{farms.length}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">{t('dashboard.total_plots')}</div>
          <div className="stat-value">{total_plots}</div>
        </div>
        <div className="card stat-card stat-card-alt">
          <div className="stat-label">{t('dashboard.total_spent')}</div>
          <div className="stat-value">₹{total_spent.toLocaleString('en-IN')}</div>
        </div>
        <div className="card stat-card stat-card-earn">
          <div className="stat-label">{t('dashboard.total_earned')}</div>
          <div className="stat-value">₹{total_earned.toLocaleString('en-IN')}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">{t('dashboard.net')}</div>
          <div className="stat-value">₹{net.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="card analytics-card">
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
