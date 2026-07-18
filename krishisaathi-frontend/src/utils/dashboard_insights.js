/**
 * Build actionable dashboard recommendations from weather + farm context.
 * UI-only helper — no API changes.
 */
export function buildTodayRecommendations({
  t,
  weather,
  pending_income_crops = [],
  reminders = [],
  net = 0,
  farms_count = 0,
}) {
  const items = [];
  const rain_chance = Number(weather?.current?.rain_chance ?? 0);
  const tomorrow = weather?.forecast?.[0];
  const tomorrow_rain = Number(tomorrow?.rain_chance ?? 0);
  const condition = String(weather?.current?.condition || '').toLowerCase();

  if (rain_chance >= 60 || condition.includes('rain')) {
    items.push({
      id: 'rain_spray',
      icon: '✅',
      text: t('recommendations.rain_avoid_spray'),
    });
    items.push({
      id: 'rain_irrigate',
      icon: '💧',
      text: t('recommendations.rain_skip_irrigation'),
    });
  } else if (rain_chance >= 35 || tomorrow_rain >= 50) {
    items.push({
      id: 'rain_soon',
      icon: '🌧',
      text: t('recommendations.rain_soon'),
    });
  } else if (weather?.advisory) {
    items.push({
      id: 'weather_advisory',
      icon: '☀️',
      text: weather.advisory,
    });
  }

  if (pending_income_crops.length > 0) {
    items.push({
      id: 'pending_sale',
      icon: '📈',
      text: t('recommendations.pending_sales', { count: pending_income_crops.length }),
    });
  }

  const due_soon = reminders
    .filter((item) => item.status === 'pending')
    .slice(0, 2);

  due_soon.forEach((reminder) => {
    items.push({
      id: `reminder_${reminder.id}`,
      icon: '⏰',
      text: reminder.title || t('recommendations.reminder_fallback'),
    });
  });

  if (net < 0 && farms_count > 0) {
    items.push({
      id: 'net_loss',
      icon: '📉',
      text: t('recommendations.watch_expenses'),
    });
  } else if (net > 0 && farms_count > 0) {
    items.push({
      id: 'net_profit',
      icon: '📈',
      text: t('recommendations.in_profit'),
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'default',
      icon: '🌱',
      text: t('recommendations.default'),
    });
  }

  return items.slice(0, 5);
}

export function buildWeatherAdvice(t, weather) {
  if (!weather) {
    return [];
  }

  const tips = [];
  const rain_chance = Number(weather.current?.rain_chance ?? 0);
  const tomorrow_rain = Number(weather.forecast?.[0]?.rain_chance ?? 0);
  const condition = String(weather.current?.condition || '').toLowerCase();

  if (rain_chance >= 60 || condition.includes('rain')) {
    tips.push(t('weather.advice_delay_spray'));
    tips.push(t('weather.advice_skip_irrigation'));
    tips.push(t('weather.advice_harvest_after_rain'));
  } else if (tomorrow_rain >= 50) {
    tips.push(t('weather.advice_rain_tomorrow'));
  } else if (rain_chance < 20) {
    tips.push(t('weather.advice_good_field_work'));
  }

  if (weather.advisory && tips.length < 2) {
    tips.unshift(weather.advisory);
  }

  return [...new Set(tips)].slice(0, 3);
}

const STAGE_ICON_MAP = {
  planting: '🌱',
  sowing: '🌱',
  land_preparation: '🪴',
  nursery: '🌿',
  transplanting: '🌿',
  earthing_up: '🌿',
  weeding: '🌿',
  irrigation: '💧',
  fertilizer: '🧪',
  pest_control: '🛡',
  flowering: '🌸',
  growth: '🌿',
  harvest: '🌾',
};

export function stageKey(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function translateStageName(t, name) {
  const key = stageKey(name);
  if (!key) {
    return name;
  }

  const path = `crops.stages.${key}`;
  const translated = t(path);
  return translated === path ? name : translated;
}

export function stageIcon(name) {
  return STAGE_ICON_MAP[stageKey(name)] || '🌱';
}
