const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const IncomeService = require('../incomes/IncomeService');

const MAX_FARMS_PER_USER = 10;
const MAX_PLOTS_PER_USER = 100;

class UserService {
  async getProfile(user_id) {
    const user = await db('users').where({ id: user_id, is_active: true }).first();

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return this.#sanitizeUser(user);
  }

  async updateProfile(user_id, updates) {
    const allowed_fields = ['name', 'preferred_language', 'preferred_land_unit', 'state_code', 'district'];
    const payload = {};

    allowed_fields.forEach((field) => {
      if (updates[field] !== undefined) {
        payload[field] = updates[field];
      }
    });

    if (Object.keys(payload).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    if (payload.district !== undefined) {
      payload.district = String(payload.district || '').trim() || null;
    }

    try {
      await db('users').where({ id: user_id }).update(payload);
    } catch (error) {
      if (error?.code === 'ER_BAD_FIELD_ERROR' || String(error.message || '').includes('district')) {
        throw ApiError.internal('Profile location update needs a database migration. Please redeploy the API.');
      }
      throw error;
    }

    if (payload.district !== undefined || payload.state_code !== undefined) {
      const farm_updates = {};
      if (payload.district !== undefined) {
        farm_updates.district = payload.district;
      }
      if (payload.state_code !== undefined) {
        const { resolveStateName } = require('../../utils/location_names');
        const state_name = resolveStateName(payload.state_code, 'en');
        if (state_name) {
          farm_updates.state = state_name;
        }
      }

      if (Object.keys(farm_updates).length > 0) {
        try {
          await db('farms').where({ user_id, is_active: true }).update(farm_updates);
        } catch (error) {
          console.warn('[users] farm location sync failed:', error.message);
        }
      }

      try {
        const WeatherService = require('../weather/WeatherService');
        await WeatherService.clearUserCache(user_id);
      } catch (error) {
        console.warn('[users] weather cache clear failed:', error.message);
      }
    }

    return this.getProfile(user_id);
  }

  async getLimits(user_id) {
    const farm_count = await db('farms').where({ user_id, is_active: true }).count('id as count').first();
    const plot_count = await db('plots')
      .join('farms', 'plots.farm_id', 'farms.id')
      .where('farms.user_id', user_id)
      .where('plots.is_active', true)
      .count('plots.id as count')
      .first();

    return {
      farms: { used: Number(farm_count.count), max: MAX_FARMS_PER_USER },
      plots: { used: Number(plot_count.count), max: MAX_PLOTS_PER_USER },
    };
  }

  async getProfileOverview(user_id) {
    const user = await this.getProfile(user_id);
    const limits = await this.getLimits(user_id);

    const [active_crops_row, money_totals, income_totals, pending_crops] = await Promise.all([
      db('crop_cycles')
        .join('plots', 'crop_cycles.plot_id', 'plots.id')
        .join('farms', 'plots.farm_id', 'farms.id')
        .where('farms.user_id', user_id)
        .where('farms.is_active', true)
        .where('plots.is_active', true)
        .whereIn('crop_cycles.status', ['planned', 'active'])
        .count('crop_cycles.id as count')
        .first(),
      db('farm_expenses')
        .where({ user_id })
        .select(
          db.raw('COALESCE(SUM(amount), 0) as expense_total'),
          db.raw('COUNT(id) as expense_count'),
        )
        .first(),
      db('farm_incomes')
        .where({ user_id })
        .select(
          db.raw('COALESCE(SUM(amount), 0) as income_total'),
          db.raw('COUNT(id) as income_count'),
        )
        .first(),
      IncomeService.getPendingIncomeCrops(user_id),
    ]);

    const expense_total = Number(money_totals.expense_total || 0);
    const income_total = Number(income_totals.income_total || 0);

    return {
      user,
      limits,
      stats: {
        active_crops: Number(active_crops_row.count || 0),
        pending_income_crops: pending_crops.length,
        expense_total,
        expense_count: Number(money_totals.expense_count || 0),
        income_total,
        income_count: Number(income_totals.income_count || 0),
        net: income_total - expense_total,
      },
    };
  }

  #sanitizeUser(user) {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      preferred_language: user.preferred_language,
      preferred_land_unit: user.preferred_land_unit,
      state_code: user.state_code,
      district: user.district || null,
      created_at: user.created_at,
    };
  }
}

module.exports = {
  service: new UserService(),
  MAX_FARMS_PER_USER,
  MAX_PLOTS_PER_USER,
};
