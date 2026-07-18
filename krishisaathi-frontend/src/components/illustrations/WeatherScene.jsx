function WeatherScene({ mood = 'clear', className = '' }) {
  return (
    <div className={`weather-scene mood-${mood} is-quiet ${className}`} aria-hidden="true">
      <div className="weather-scene-sky" />
      <div className="weather-scene-glow" />

      {mood === 'clear' && (
        <div className="weather-sun is-soft">
          <span className="weather-sun-core" />
          <span className="weather-sun-halo" />
        </div>
      )}

      {(mood === 'cloud' || mood === 'haze' || mood === 'rain') && (
        <div className="weather-clouds is-soft">
          <span className="cloud c1" />
          <span className="cloud c2" />
        </div>
      )}

      {mood === 'rain' && (
        <div className="weather-rain is-soft">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className={`raindrop d${index + 1}`} />
          ))}
        </div>
      )}

      <svg className="weather-field-line" viewBox="0 0 400 90" preserveAspectRatio="none">
        <path
          className="field-hill back"
          d="M0 70 C60 40, 120 55, 180 48 C240 40, 300 58, 400 42 L400 90 L0 90 Z"
        />
        <path
          className="field-hill front"
          d="M0 78 C80 60, 140 72, 210 64 C280 56, 340 70, 400 60 L400 90 L0 90 Z"
        />
        <g className="field-crops is-soft">
          <path d="M55 80 C58 62, 52 50, 55 42" />
          <path d="M120 76 C123 55, 118 45, 121 36" />
          <path d="M210 74 C214 52, 208 42, 212 32" />
          <path d="M290 78 C294 58, 288 48, 292 38" />
          <path d="M350 76 C354 54, 348 44, 352 34" />
        </g>
      </svg>
    </div>
  );
}

export default WeatherScene;
