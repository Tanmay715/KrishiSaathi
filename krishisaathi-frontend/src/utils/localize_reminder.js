import { localizeCropName } from './localize_names';

/**
 * Generated reminders store the title they were created with, so a farmer who switches
 * language later would keep seeing the old one. The payload carries a stable title key,
 * which lets us rebuild the title in the language that is active right now.
 */
export function reminderTitle(t, reminder, language) {
  const payload = parsePayload(reminder?.payload);
  const stored_title = reminder?.title || '';
  const title_key = payload?.title_key;

  if (!title_key) {
    return stored_title;
  }

  const translated = t(`reminders.rule_titles.${title_key}`, { defaultValue: '' });

  if (!translated) {
    return stored_title;
  }

  if (title_key === 'weather_delay_spray') {
    return payload.farm_name ? `${payload.farm_name}: ${translated}` : translated;
  }

  const crop = localizeCropName(payload.crop_name, language);
  return crop ? `${translated} — ${crop}` : translated;
}

function parsePayload(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}
