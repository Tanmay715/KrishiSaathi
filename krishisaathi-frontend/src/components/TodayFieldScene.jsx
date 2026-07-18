import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WeatherScene from './illustrations/WeatherScene';
import HealthBloom from './illustrations/HealthBloom';
import { weatherMood } from '../utils/field_identity';
import { normalizeLanguage } from '../utils/language';

function formatForecastDate(iso_date, language) {
  const date = new Date(`${iso_date}T00:00:00`);
  return date.toLocaleDateString(normalizeLanguage(language) === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
  });
}

function TodayFieldScene({
  weather,
  primary_action,
  weather_advice = [],
  greeting,
  health,
  farms_count,
  plots_count,
  earned,
  spent,
  net,
}) {
  const { t, i18n } = useTranslation();
  const mood = weatherMood(weather);
  const temp = weather?.current?.temperature_c != null
    ? Math.round(weather.current.temperature_c)
    : null;
  const rain = weather?.current?.rain_chance ?? 0;
  const location = [weather?.location?.name, weather?.location?.region]
    .filter(Boolean)
    .join(', ');
  const is_profit = net >= 0;

  return (
    <section className={`today-field mood-${mood}`} aria-label={t('dashboard.hero_label')}>
      <WeatherScene mood={mood} />

      <div className="today-field-content">
        <header className="today-field-top">
          <div>
            <p className="today-field-greeting">{greeting}</p>
            <h1 className="today-field-brand">{t('app.name')}</h1>
          </div>
          <div className={`today-field-rain${rain >= 50 ? ' is-urgent' : ''}`}>
            <em>{rain}%</em>
            <span>{t('weather.rain_chance')}</span>
          </div>
        </header>

        <div className="today-field-weather-row">
          <div className="today-field-temp">
            <span className="today-field-degree">{temp != null ? `${temp}°` : '—'}</span>
            <div>
              <strong>{weather?.current?.condition || t('weather.title')}</strong>
              {location && <p>{location}</p>}
            </div>
          </div>
        </div>

        <div className="today-field-stage">
          <div className="today-field-focus">
            <span className="today-field-kicker">{t('dashboard.do_today')}</span>
            <p>{primary_action?.text || t('recommendations.default')}</p>
            {weather_advice[0] && <small>{weather_advice[0]}</small>}
          </div>

          <div className="today-field-health">
            <HealthBloom
              score={health.score}
              tone={health.tone}
              label={t('dashboard.farm_health')}
              sublabel={t(`dashboard.health_${health.band}`)}
            />
            <div className="today-field-health-meta">
              <p>
                {farms_count} {t('dashboard.farms_short')}
                {' · '}
                {plots_count} {t('dashboard.plots_short')}
              </p>
              <div className="today-field-money">
                <span>
                  <em>{t('dashboard.total_earned')}</em>
                  ₹{earned.toLocaleString('en-IN')}
                </span>
                <span>
                  <em>{t('dashboard.total_spent')}</em>
                  ₹{spent.toLocaleString('en-IN')}
                </span>
                <span className={is_profit ? 'is-up' : 'is-down'}>
                  <em>{is_profit ? t('finance.status_profit') : t('finance.status_loss')}</em>
                  {is_profit ? '+' : '-'}₹{Math.abs(net).toLocaleString('en-IN')}
                </span>
              </div>
              <Link to="/farms" className="today-field-farms-link">{t('nav.farms')} →</Link>
            </div>
          </div>
        </div>

        {weather?.forecast?.length > 0 && (
          <div className="today-field-forecast">
            {weather.forecast.slice(0, 3).map((day) => (
              <div key={day.date} className="today-field-day">
                <span>{formatForecastDate(day.date, i18n.resolvedLanguage || i18n.language)}</span>
                <strong>{Math.round(day.temp_max)}°</strong>
                <small>{day.rain_chance}%</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default TodayFieldScene;
