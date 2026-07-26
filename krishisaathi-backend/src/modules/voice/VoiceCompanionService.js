const db = require('../../db/connection');
const WeatherService = require('../weather/WeatherService');

/**
 * Builds the mic-open briefing for Fasalya's companion personality.
 * Every proactive line must pass the trust gate: useful now, based on real
 * farm data, and likely to save time or money — otherwise it stays quiet.
 */
class VoiceCompanionService {
  async getOpenBriefing(user_id, { farm_id = null } = {}) {
    const user = await db('users').where({ id: user_id, is_active: true }).first();
    const language = user?.preferred_language === 'hi' ? 'hi' : 'en';
    const name = firstName(user?.name);
    const region = regionFlavor(user?.state_code);

    const [urgent, memory, celebration] = await Promise.all([
      this.#urgentAlerts(user_id, farm_id, language),
      this.#memoryLine(user_id, farm_id, language),
      this.#celebrationLine(user_id, farm_id, language),
    ]);

    return {
      farmer_name: name,
      language,
      region,
      urgent: urgent.filter((item) => passesTrust(item)),
      memory: memory && passesTrust(memory) ? memory : null,
      celebration: celebration && passesTrust(celebration) ? celebration : null,
    };
  }

  async #urgentAlerts(user_id, farm_id, language) {
    const alerts = [];
    const weather = await this.#safeWeather(user_id, farm_id);
    const rain = Number(weather?.current?.rain_chance || 0);
    const advisory = String(weather?.advisory || '');

    if (rain >= 60 || /rain|बारिश|heavy/i.test(advisory)) {
      alerts.push({
        type: 'weather',
        useful_now: true,
        based_on_data: true,
        saves_time_or_money: true,
        text: language === 'hi'
          ? rain >= 70
            ? 'अगले 24 घंटे में तेज़ बारिश की संभावना है। स्प्रे टालना बेहतर रहेगा।'
            : 'बारिश की संभावना है। स्प्रे या सिंचाई का प्लान बदलना पड़ सकता है।'
          : rain >= 70
            ? 'Heavy rain likely in the next 24 hours. Better to postpone spray.'
            : 'Rain is likely. You may need to adjust spray or irrigation.',
      });
    }

    const reminder = await this.#nextDueReminder(user_id, farm_id);
    if (reminder) {
      const when = isOverdue(reminder.due_at)
        ? (language === 'hi' ? 'आज बाकी है' : 'is due')
        : (language === 'hi' ? 'आज है' : 'is today');
      const title = reminderTitle(reminder, language);
      alerts.push({
        type: 'reminder',
        useful_now: true,
        based_on_data: true,
        saves_time_or_money: true,
        text: language === 'hi'
          ? `${title} ${when}।`
          : `${title} ${when}.`,
      });
    }

    return alerts.slice(0, 1);
  }

  async #memoryLine(user_id, farm_id, language) {
    const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    let query = db('farm_expenses')
      .join('farms', 'farm_expenses.farm_id', 'farms.id')
      .where('farms.user_id', user_id)
      .where('farms.is_active', true)
      .andWhere('farm_expenses.expense_date', '>=', since.toISOString().slice(0, 10))
      .select(
        'farm_expenses.title',
        'farm_expenses.category',
        'farm_expenses.expense_date',
        'farms.name as farm_name',
      )
      .orderBy('farm_expenses.expense_date', 'desc')
      .limit(1);

    if (farm_id) {
      query = query.andWhere('farm_expenses.farm_id', farm_id);
    }

    const row = await query.first();
    if (!row) {
      return null;
    }

    const label = row.title || row.category || (language === 'hi' ? 'खर्च' : 'expense');
    const when = relativeDay(row.expense_date, language);

    return {
      type: 'memory',
      useful_now: false,
      based_on_data: true,
      saves_time_or_money: false,
      // Memory is only used when the farmer asks a follow-up — not spoken on every open.
      speak_on_open: false,
      text: language === 'hi'
        ? `${when} आपने ${label} का खर्च डाला था।`
        : `${when} you logged ${label}.`,
    };
  }

  async #celebrationLine(user_id, farm_id, language) {
    let query = db('crop_cycles')
      .join('plots', 'crop_cycles.plot_id', 'plots.id')
      .join('farms', 'plots.farm_id', 'farms.id')
      .where('farms.user_id', user_id)
      .where('farms.is_active', true)
      .where('plots.is_active', true)
      .whereIn('crop_cycles.status', ['planned', 'active'])
      .select('crop_cycles.crop_name', 'crop_cycles.lifecycle_stages', 'crop_cycles.updated_at')
      .orderBy('crop_cycles.updated_at', 'desc')
      .limit(8);

    if (farm_id) {
      query = query.andWhere('farms.id', farm_id);
    }

    const crops = await query;
    const harvest = crops.find((crop) => isEnteringHarvest(crop));
    if (!harvest) {
      return null;
    }

    return {
      type: 'celebration',
      useful_now: true,
      based_on_data: true,
      saves_time_or_money: true,
      speak_on_open: true,
      text: language === 'hi'
        ? `बधाई हो! आपकी ${harvest.crop_name} फसल कटाई के करीब पहुँच गई है।`
        : `Good news — your ${harvest.crop_name} crop is nearing harvest.`,
    };
  }

  async #nextDueReminder(user_id, farm_id) {
    const end = endOfTomorrow();
    let query = db('farm_reminders')
      .where({ user_id, status: 'pending' })
      .andWhere('due_at', '<=', end)
      .orderBy('due_at', 'asc')
      .limit(1);

    if (farm_id) {
      query = query.andWhere({ farm_id });
    }

    return query.first();
  }

  async #safeWeather(user_id, farm_id) {
    try {
      return await WeatherService.getWeatherForUser(user_id, farm_id || undefined);
    } catch (_error) {
      return null;
    }
  }
}

function passesTrust(item) {
  if (!item) {
    return false;
  }

  if (item.speak_on_open === false) {
    return true;
  }

  return Boolean(item.useful_now && item.based_on_data && item.saves_time_or_money);
}

function firstName(name) {
  const text = String(name || '').trim();
  if (!text) {
    return null;
  }

  return text.split(/\s+/)[0];
}

function regionFlavor(state_code) {
  const code = String(state_code || '').toUpperCase();
  if (['BR', 'JH'].includes(code)) {
    return 'bhojpuri';
  }
  if (code === 'MH') {
    return 'marathi';
  }
  if (code === 'PB') {
    return 'punjabi';
  }
  return 'hindi';
}

function endOfTomorrow() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  date.setDate(date.getDate() + 1);
  return date;
}

function isOverdue(due_at) {
  return new Date(due_at).getTime() < Date.now();
}

function reminderTitle(reminder, language) {
  if (reminder.payload) {
    try {
      const payload = typeof reminder.payload === 'string'
        ? JSON.parse(reminder.payload)
        : reminder.payload;
      if (payload?.title_hi && language === 'hi') {
        return payload.title_hi;
      }
      if (payload?.title_en && language === 'en') {
        return payload.title_en;
      }
    } catch (_error) {
      // fall through
    }
  }

  return reminder.title || (language === 'hi' ? 'याद दिलाने वाली बात' : 'A reminder');
}

function relativeDay(iso_date, language) {
  const day = String(iso_date || '').slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (day === today) {
    return language === 'hi' ? 'आज' : 'Today';
  }
  if (day === yesterday) {
    return language === 'hi' ? 'कल' : 'Yesterday';
  }

  return language === 'hi' ? 'पिछले दिनों' : 'Recently';
}

function isEnteringHarvest(crop) {
  const stages = parseStages(crop.lifecycle_stages);
  if (!stages.length) {
    return false;
  }

  const current = stages.find((stage) => !stage.completed) || stages[stages.length - 1];
  const name = String(current?.name || current?.key || '').toLowerCase();
  return /harvest|कटाई|cutting/.test(name);
}

function parseStages(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

module.exports = new VoiceCompanionService();
