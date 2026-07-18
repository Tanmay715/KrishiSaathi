const { v4: uuidv4 } = require('uuid');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const ActivityService = require('../activity/ActivityService');
const { MAX_FARMS_PER_USER } = require('../users/UserService');

class FarmService {
  async listFarms(user_id) {
    const farms = await db('farms')
      .where({ user_id, is_active: true })
      .orderBy('created_at', 'desc');

    const farm_ids = farms.map((farm) => farm.id);

    if (farm_ids.length === 0) {
      return [];
    }

    const plot_counts = await db('plots')
      .select('farm_id')
      .count('id as plot_count')
      .whereIn('farm_id', farm_ids)
      .where('is_active', true)
      .groupBy('farm_id');

    const count_map = Object.fromEntries(
      plot_counts.map((row) => [row.farm_id, Number(row.plot_count)]),
    );

    return farms.map((farm) => ({
      ...farm,
      plot_count: count_map[farm.id] || 0,
    }));
  }

  async getQuickLogTargets(user_id) {
    const crop_rows = await db('crop_cycles')
      .join('plots', 'crop_cycles.plot_id', 'plots.id')
      .join('farms', 'plots.farm_id', 'farms.id')
      .where('farms.user_id', user_id)
      .where('farms.is_active', true)
      .where('plots.is_active', true)
      .whereIn('crop_cycles.status', ['planned', 'active'])
      .select(
        'crop_cycles.id as crop_cycle_id',
        'crop_cycles.crop_name',
        'plots.id as plot_id',
        'plots.name as plot_name',
        'farms.id as farm_id',
        'farms.name as farm_name',
      )
      .orderBy('farms.name', 'asc')
      .orderBy('plots.name', 'asc');

    const farm_rows = await db('farms')
      .where({ user_id, is_active: true })
      .select('id as farm_id', 'name as farm_name')
      .orderBy('name', 'asc');

    const plot_rows = await db('plots')
      .join('farms', 'plots.farm_id', 'farms.id')
      .where('farms.user_id', user_id)
      .where('farms.is_active', true)
      .where('plots.is_active', true)
      .select(
        'plots.id as plot_id',
        'plots.name as plot_name',
        'farms.id as farm_id',
        'farms.name as farm_name',
      )
      .orderBy('farms.name', 'asc')
      .orderBy('plots.name', 'asc');

    const targets = [
      ...crop_rows.map((row) => ({
        ...row,
        target_type: 'crop',
        target_key: `crop:${row.crop_cycle_id}`,
      })),
      ...plot_rows.map((row) => ({
        farm_id: row.farm_id,
        farm_name: row.farm_name,
        plot_id: row.plot_id,
        plot_name: row.plot_name,
        crop_cycle_id: null,
        crop_name: null,
        target_type: 'plot',
        target_key: `plot:${row.plot_id}`,
      })),
      ...farm_rows.map((row) => ({
        farm_id: row.farm_id,
        farm_name: row.farm_name,
        plot_id: null,
        plot_name: null,
        crop_cycle_id: null,
        crop_name: null,
        target_type: 'farm',
        target_key: `farm:${row.farm_id}`,
      })),
    ];

    return targets;
  }

  async getFarmById(user_id, farm_id) {
    const farm = await this.#findOwnedFarm(user_id, farm_id);
    const plots = await db('plots').where({ farm_id, is_active: true }).orderBy('created_at', 'asc');

    const plot_ids = plots.map((plot) => plot.id);
    let active_crops = [];

    if (plot_ids.length > 0) {
      active_crops = await db('crop_cycles')
        .whereIn('plot_id', plot_ids)
        .whereIn('status', ['planned', 'active'])
        .orderBy('created_at', 'desc');
    }

    const crop_map = {};
    active_crops.forEach((crop) => {
      if (!crop_map[crop.plot_id]) {
        crop_map[crop.plot_id] = crop;
      }
    });

    const plots_with_crops = plots.map((plot) => ({
      ...plot,
      active_crop: crop_map[plot.id] || null,
    }));

    const finance = await this.#getFarmFinance(user_id, farm_id, plot_ids);

    return {
      ...farm,
      plots: plots_with_crops.map((plot) => ({
        ...plot,
        expense_total: finance.plot_expenses[plot.id] || 0,
        income_total: finance.plot_incomes[plot.id] || 0,
        profit: (finance.plot_incomes[plot.id] || 0) - (finance.plot_expenses[plot.id] || 0),
      })),
      finance: {
        expense_total: finance.expense_total,
        income_total: finance.income_total,
        profit: finance.income_total - finance.expense_total,
        expense_count: finance.expense_count,
        income_count: finance.income_count,
      },
    };
  }

  async createFarm(user_id, payload) {
    await this.#ensureFarmLimit(user_id);

    const farm_id = uuidv4();
    await db('farms').insert({
      id: farm_id,
      user_id,
      name: payload.name,
      state: payload.state || null,
      district: payload.district || null,
      village: payload.village || null,
      total_area: payload.total_area || 0,
      notes: payload.notes || null,
    });

    await ActivityService.logActivity(
      user_id,
      'farm_created',
      `Created farm "${payload.name}"`,
      'farm',
      farm_id,
    );

    return this.getFarmById(user_id, farm_id);
  }

  async updateFarm(user_id, farm_id, payload) {
    await this.#findOwnedFarm(user_id, farm_id);

    const allowed_fields = ['name', 'state', 'district', 'village', 'total_area', 'notes'];
    const updates = {};
    allowed_fields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates[field] = payload[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    await db('farms').where({ id: farm_id }).update(updates);

    await ActivityService.logActivity(
      user_id,
      'farm_updated',
      `Updated farm "${updates.name || farm_id}"`,
      'farm',
      farm_id,
    );

    return this.getFarmById(user_id, farm_id);
  }

  async deleteFarm(user_id, farm_id) {
    const farm = await this.#findOwnedFarm(user_id, farm_id);
    await db('farms').where({ id: farm_id }).update({ is_active: false });

    await ActivityService.logActivity(
      user_id,
      'farm_deleted',
      `Archived farm "${farm.name}"`,
      'farm',
      farm_id,
    );
  }

  async #findOwnedFarm(user_id, farm_id) {
    const farm = await db('farms').where({ id: farm_id, user_id, is_active: true }).first();

    if (!farm) {
      throw ApiError.notFound('Farm not found');
    }

    return farm;
  }

  async #ensureFarmLimit(user_id) {
    const result = await db('farms').where({ user_id, is_active: true }).count('id as count').first();

    if (Number(result.count) >= MAX_FARMS_PER_USER) {
      throw ApiError.badRequest(`Maximum ${MAX_FARMS_PER_USER} farms allowed per account`);
    }
  }

  async #getFarmFinance(user_id, farm_id, plot_ids) {
    const expense_summary = await db('farm_expenses')
      .where({ farm_id, user_id })
      .sum('amount as total')
      .count('id as count')
      .first();

    const income_summary = await db('farm_incomes')
      .where({ farm_id, user_id })
      .sum('amount as total')
      .count('id as count')
      .first();

    const plot_expenses = {};
    const plot_incomes = {};

    if (plot_ids.length > 0) {
      const expense_rows = await db('farm_expenses')
        .where({ farm_id, user_id })
        .whereIn('plot_id', plot_ids)
        .select('plot_id')
        .sum('amount as total')
        .groupBy('plot_id');

      expense_rows.forEach((row) => {
        plot_expenses[row.plot_id] = Number(row.total || 0);
      });

      const income_rows = await db('farm_incomes')
        .where({ farm_id, user_id })
        .whereIn('plot_id', plot_ids)
        .select('plot_id')
        .sum('amount as total')
        .groupBy('plot_id');

      income_rows.forEach((row) => {
        plot_incomes[row.plot_id] = Number(row.total || 0);
      });
    }

    return {
      expense_total: Number(expense_summary.total || 0),
      expense_count: Number(expense_summary.count || 0),
      income_total: Number(income_summary.total || 0),
      income_count: Number(income_summary.count || 0),
      plot_expenses,
      plot_incomes,
    };
  }
}

module.exports = new FarmService();
