const { v4: uuidv4 } = require('uuid');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const WeatherService = require('../weather/WeatherService');
const { buildRuleReminders } = require('./reminder_rules');

class ReminderService {
  async listReminders(user_id, { farm_id = null, status = 'pending' } = {}) {
    const query = db('farm_reminders').where({ user_id });

    if (farm_id) {
      query.andWhere({ farm_id });
    }

    if (status && status !== 'all') {
      query.andWhere({ status });
    }

    return query.orderBy('due_at', 'asc').limit(100);
  }

  async createReminder(user_id, payload) {
    if (payload.farm_id) {
      await this.#ensureFarm(user_id, payload.farm_id);
    }

    const reminder_id = uuidv4();
    await db('farm_reminders').insert({
      id: reminder_id,
      user_id,
      farm_id: payload.farm_id || null,
      plot_id: payload.plot_id || null,
      crop_cycle_id: payload.crop_cycle_id || null,
      type: payload.type || 'custom',
      title: payload.title,
      due_at: payload.due_at,
      status: 'pending',
      source: 'manual',
      payload: payload.payload ? JSON.stringify(payload.payload) : null,
    });

    return db('farm_reminders').where({ id: reminder_id }).first();
  }

  async updateReminder(user_id, reminder_id, payload) {
    const reminder = await db('farm_reminders').where({ id: reminder_id, user_id }).first();

    if (!reminder) {
      throw ApiError.notFound('Reminder not found');
    }

    const updates = {};

    if (payload.status) {
      updates.status = payload.status;
    }

    if (payload.title) {
      updates.title = payload.title;
    }

    if (payload.due_at) {
      updates.due_at = payload.due_at;
    }

    if (payload.type) {
      updates.type = payload.type;
    }

    if (Object.keys(updates).length === 0) {
      return reminder;
    }

    updates.updated_at = db.fn.now();
    await db('farm_reminders').where({ id: reminder_id }).update(updates);

    return db('farm_reminders').where({ id: reminder_id }).first();
  }

  async generateReminders(user_id) {
    const user = await db('users').where({ id: user_id }).first();
    const language = user?.preferred_language || 'en';

    await db('farm_reminders')
      .where({ user_id, source: 'rule', status: 'pending' })
      .del();
    await db('farm_reminders')
      .where({ user_id, source: 'weather', status: 'pending' })
      .del();

    const crops = await db('crop_cycles')
      .join('plots', 'crop_cycles.plot_id', 'plots.id')
      .join('farms', 'plots.farm_id', 'farms.id')
      .leftJoin('crop_templates', 'crop_cycles.crop_template_id', 'crop_templates.id')
      .where('farms.user_id', user_id)
      .where('farms.is_active', true)
      .whereIn('crop_cycles.status', ['planned', 'active'])
      .select(
        'crop_cycles.id',
        'crop_cycles.crop_name',
        'crop_cycles.sowing_date',
        'crop_cycles.expected_harvest_date',
        'crop_templates.category',
        'plots.id as plot_id',
        'farms.id as farm_id',
      );

    const rows = [];

    for (const crop of crops) {
      const rules = buildRuleReminders(crop, language);
      for (const rule of rules) {
        if (rule.due_at < new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)) {
          continue;
        }

        rows.push({
          id: uuidv4(),
          user_id,
          farm_id: rule.farm_id,
          plot_id: rule.plot_id,
          crop_cycle_id: rule.crop_cycle_id,
          type: rule.type,
          title: `${rule.title} — ${crop.crop_name}`,
          due_at: rule.due_at,
          status: 'pending',
          source: 'rule',
          payload: JSON.stringify(rule.payload),
        });
      }
    }

    const farms = await db('farms').where({ user_id, is_active: true }).limit(5);

    for (const farm of farms) {
      try {
        const weather = await WeatherService.getWeatherForUser(user_id, farm.id);
        const rain_chance = Number(weather?.current?.rain_chance || 0);
        const advisory = String(weather?.advisory || '').toLowerCase();

        if (rain_chance >= 60 || advisory.includes('rain') || advisory.includes('बारिश')) {
          rows.push({
            id: uuidv4(),
            user_id,
            farm_id: farm.id,
            plot_id: null,
            crop_cycle_id: null,
            type: 'weather',
            title: language === 'hi'
              ? `${farm.name}: बारिश की वजह से छिड़काव टालें`
              : `${farm.name}: Delay spray due to rain risk`,
            due_at: new Date(),
            status: 'pending',
            source: 'weather',
            payload: JSON.stringify({
              title_key: 'weather_delay_spray',
              farm_name: farm.name,
              rain_chance,
              advisory: weather?.advisory || null,
            }),
          });
        }
      } catch (error) {
        console.error('[reminders] weather generate failed:', error.message);
      }
    }

    if (rows.length > 0) {
      await db('farm_reminders').insert(rows);
    }

    return this.listReminders(user_id, { status: 'pending' });
  }

  async #ensureFarm(user_id, farm_id) {
    const farm = await db('farms').where({ id: farm_id, user_id, is_active: true }).first();

    if (!farm) {
      throw ApiError.notFound('Farm not found');
    }

    return farm;
  }
}

module.exports = new ReminderService();
