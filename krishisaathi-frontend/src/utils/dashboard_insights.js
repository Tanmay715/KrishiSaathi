/**
 * Build dashboard insight tips from weather + farm context.
 * Reminder tasks stay in the reminders list — never duplicated here.
 */
export function buildTodayRecommendations({
  t,
  weather,
  pending_income_crops = [],
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
      tone: 'weather',
      icon: 'rain',
      text: t('recommendations.rain_avoid_spray'),
    });
  } else if (rain_chance >= 35 || tomorrow_rain >= 50) {
    items.push({
      id: 'rain_soon',
      tone: 'weather',
      icon: 'cloud',
      text: t('recommendations.rain_soon'),
    });
  } else if (rain_chance < 20 && weather) {
    items.push({
      id: 'fair_day',
      tone: 'calm',
      icon: 'sun',
      text: t('weather.advice_good_field_work'),
    });
  } else if (weather?.advisory) {
    items.push({
      id: 'weather_advisory',
      tone: 'calm',
      icon: 'cloud',
      text: weather.advisory,
    });
  }

  if (pending_income_crops.length > 0) {
    items.push({
      id: 'pending_sale',
      tone: 'money',
      icon: 'money',
      text: t('recommendations.pending_sales', { count: pending_income_crops.length }),
    });
  }

  if (net < 0 && farms_count > 0) {
    items.push({
      id: 'net_loss',
      tone: 'money',
      icon: 'money',
      text: t('recommendations.watch_expenses'),
    });
  } else if (net > 0 && farms_count > 0) {
    items.push({
      id: 'net_profit',
      tone: 'calm',
      icon: 'sprout',
      text: t('recommendations.in_profit'),
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'default',
      tone: 'calm',
      icon: 'sprout',
      text: t('recommendations.default'),
    });
  }

  return items.slice(0, 3);
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
