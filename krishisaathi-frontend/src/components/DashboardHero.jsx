import { useTranslation } from 'react-i18next';

function formatForecastDate(iso_date, language) {
  const date = new Date(`${iso_date}T00:00:00`);
  return date.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
  });
}

function weatherMood(weather) {
  const rain = Number(weather?.current?.rain_chance ?? 0);
  const condition = String(weather?.current?.condition || '').toLowerCase();
  if (rain >= 60 || condition.includes('rain')) {
    return 'rain';
  }
  if (rain >= 35) {
    return 'cloud';
  }
  return 'clear';
}

function DashboardHero({
  weather,
  primary_action,
  weather_advice = [],
  greeting,
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

  return (
    <section className={`dash-hero mood-${mood} fade-in`} aria-label={t('dashboard.hero_label')}>
      <div className="dash-hero-atmosphere" aria-hidden="true" />
      <div className="dash-hero-content">
        <p className="dash-hero-greeting">{greeting}</p>

        <div className="dash-hero-weather">
          <div className="dash-hero-temp-block">
            <span className="dash-hero-temp">
              {temp != null ? `${temp}°` : '—'}
            </span>
            <div className="dash-hero-condition">
              <strong>{weather?.current?.condition || t('weather.title')}</strong>
              {location && <span>{location}</span>}
            </div>
          </div>
          <div className={`dash-hero-rain-chip${rain >= 50 ? ' is-urgent' : ''}`}>
            <span className="dash-hero-rain-value">{rain}%</span>
            <span>{t('weather.rain_chance')}</span>
          </div>
        </div>

        {primary_action && (
          <div className="dash-hero-focus">
            <span className="dash-hero-focus-label">{t('dashboard.do_today')}</span>
            <p className="dash-hero-focus-text">{primary_action.text}</p>
            {weather_advice[0] && (
              <p className="dash-hero-focus-tip">{weather_advice[0]}</p>
            )}
          </div>
        )}

        {weather?.forecast?.length > 0 && (
          <div className="dash-hero-forecast">
            {weather.forecast.slice(0, 3).map((day) => (
              <div key={day.date} className="dash-hero-day">
                <span>{formatForecastDate(day.date, i18n.language)}</span>
                <strong>{Math.round(day.temp_max)}°</strong>
                <span className="dash-hero-day-rain">{day.rain_chance}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default DashboardHero;
