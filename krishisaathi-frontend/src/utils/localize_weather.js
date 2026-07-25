import { normalizeLanguage } from './language';
import { localizeState } from './localize_names';

/**
 * The weather API returns English place names plus Hindi variants when Open-Meteo has
 * them. Anything still English falls back to the state list, then to the raw value.
 */
export function weatherPlaceLabel(weather, language) {
  const is_hindi = normalizeLanguage(language) === 'hi';
  const location = weather?.location;

  if (!location) {
    return '';
  }

  const name = (is_hindi && location.name_hi) || location.name;
  const region = is_hindi
    ? (location.region_hi || localizeState(location.region, 'hi') || location.region)
    : location.region;

  return [name, region].filter(Boolean).join(', ');
}

export function weatherConditionLabel(t, source) {
  const code = source?.weather_code;
  const fallback = source?.condition || t('weather.title');

  if (code === null || code === undefined) {
    return fallback;
  }

  return t(`weather.conditions.${code}`, { defaultValue: fallback });
}

export function weatherAdvisoryText(t, weather) {
  if (!weather?.advisory && !weather?.advisory_key) {
    return '';
  }

  return t(`weather.advisory.${weather.advisory_key || 'default'}`, {
    defaultValue: weather.advisory || '',
  });
}
