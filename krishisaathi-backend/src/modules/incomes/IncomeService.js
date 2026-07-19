const { v4: uuidv4 } = require('uuid');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const ActivityService = require('../activity/ActivityService');
const ExpenseService = require('../expenses/ExpenseService');

class IncomeService {
  async listFarmIncomes(user_id, farm_id) {
    await this.#ensureFarmOwnership(user_id, farm_id);

    return db('farm_incomes')
      .where({ farm_id, user_id })
      .orderBy('income_date', 'desc')
      .orderBy('created_at', 'desc');
  }

  async listPlotIncomes(user_id, farm_id, plot_id) {
    await this.#ensurePlotOwnership(user_id, farm_id, plot_id);

    return db('farm_incomes')
      .where({ farm_id, plot_id, user_id })
      .orderBy('income_date', 'desc')
      .orderBy('created_at', 'desc');
  }

  async listCropIncomes(user_id, farm_id, plot_id, crop_cycle_id) {
    await this.#ensurePlotOwnership(user_id, farm_id, plot_id);

    return db('farm_incomes')
      .where({ farm_id, plot_id, user_id, crop_cycle_id })
      .orderBy('income_date', 'desc')
      .orderBy('created_at', 'desc');
  }

  async getTotalsByCropCycles(user_id, crop_cycle_ids) {
    if (!crop_cycle_ids.length) {
      return {};
    }

    const rows = await db('farm_incomes')
      .where({ user_id })
      .whereIn('crop_cycle_id', crop_cycle_ids)
      .select('crop_cycle_id')
      .sum('amount as total')
      .groupBy('crop_cycle_id');

    return Object.fromEntries(rows.map((row) => [row.crop_cycle_id, Number(row.total || 0)]));
  }

  async getIncomeSummary(user_id) {
    const result = await db('farm_incomes')
      .where({ user_id })
      .sum('amount as total_earned')
      .count('id as income_count')
      .first();

    return {
      total_earned: Number(result.total_earned || 0),
      income_count: Number(result.income_count || 0),
    };
  }

  async getPendingIncomeCrops(user_id) {
    const harvested_crops = await db('crop_cycles')
      .join('plots', 'crop_cycles.plot_id', 'plots.id')
      .join('farms', 'plots.farm_id', 'farms.id')
      .where('farms.user_id', user_id)
      .where('farms.is_active', true)
      .where('plots.is_active', true)
      .where('crop_cycles.status', 'harvested')
      .where('crop_cycles.skip_sale_income', false)
      .select(
        'crop_cycles.id',
        'crop_cycles.crop_name',
        'crop_cycles.actual_harvest_date',
        'crop_cycles.sowing_date',
        'plots.id as plot_id',
        'plots.name as plot_name',
        'farms.id as farm_id',
        'farms.name as farm_name',
      )
      .orderBy('crop_cycles.actual_harvest_date', 'desc');

    if (!harvested_crops.length) {
      return [];
    }

    const cycle_ids = harvested_crops.map((crop) => crop.id);
    const crops_with_income = await db('farm_incomes')
      .where({ user_id })
      .whereIn('crop_cycle_id', cycle_ids)
      .groupBy('crop_cycle_id')
      .pluck('crop_cycle_id');

    const income_set = new Set(crops_with_income);
    const pending_ids = cycle_ids.filter((id) => !income_set.has(id));

    if (!pending_ids.length) {
      return [];
    }

    const expense_totals = await ExpenseService.getTotalsByCropCycles(user_id, pending_ids);

    return harvested_crops
      .filter((crop) => income_set.has(crop.id) === false)
      .map((crop) => ({
        ...crop,
        expense_total: expense_totals[crop.id] || 0,
      }));
  }

  async createIncome(user_id, farm_id, payload) {
    await this.#ensureFarmOwnership(user_id, farm_id);

    const plot_id = payload.plot_id || null;
    const crop_cycle_id = payload.crop_cycle_id || null;

    if (plot_id) {
      await this.#ensurePlotOwnership(user_id, farm_id, plot_id);
    }

    if (crop_cycle_id) {
      await this.#ensureCropOwnership(farm_id, plot_id, crop_cycle_id);
    }

    const income_id = uuidv4();
    await db('farm_incomes').insert({
      id: income_id,
      user_id,
      farm_id,
      plot_id,
      crop_cycle_id,
      category: payload.category || 'other',
      title: payload.title,
      amount: payload.amount,
      quantity: payload.quantity ?? null,
      unit: payload.unit || null,
      income_date: payload.income_date,
      notes: payload.notes || null,
    });

    await ActivityService.logActivity(
      user_id,
      'income_added',
      `Logged income "${payload.title}" (₹${payload.amount})`,
      'income',
      income_id,
    );

    return db('farm_incomes').where({ id: income_id }).first();
  }

  async deleteIncome(user_id, farm_id, income_id) {
    const income = await this.#findOwnedIncome(user_id, farm_id, income_id);
    await db('farm_incomes').where({ id: income_id }).del();

    await ActivityService.logActivity(
      user_id,
      'income_deleted',
      `Deleted income "${income.title}"`,
      'income',
      income_id,
    );
  }

  async updateIncome(user_id, farm_id, income_id, payload) {
    await this.#findOwnedIncome(user_id, farm_id, income_id);

    const allowed_fields = [
      'plot_id',
      'crop_cycle_id',
      'category',
      'title',
      'amount',
      'quantity',
      'unit',
      'income_date',
      'notes',
    ];
    const updates = {};

    allowed_fields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates[field] = payload[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    if (updates.plot_id) {
      await this.#ensurePlotOwnership(user_id, farm_id, updates.plot_id);
    }

    await db('farm_incomes').where({ id: income_id }).update(updates);
    return db('farm_incomes').where({ id: income_id }).first();
  }

  async #ensureFarmOwnership(user_id, farm_id) {
    const farm = await db('farms').where({ id: farm_id, user_id, is_active: true }).first();

    if (!farm) {
      throw ApiError.notFound('Farm not found');
    }

    return farm;
  }

  async #ensurePlotOwnership(user_id, farm_id, plot_id) {
    await this.#ensureFarmOwnership(user_id, farm_id);
    const plot = await db('plots').where({ id: plot_id, farm_id, is_active: true }).first();

    if (!plot) {
      throw ApiError.notFound('Plot not found');
    }

    return plot;
  }

  async #ensureCropOwnership(farm_id, plot_id, crop_cycle_id) {
    if (!plot_id) {
      throw ApiError.badRequest('plot_id is required when linking a crop cycle');
    }

    const cycle = await db('crop_cycles')
      .join('plots', 'crop_cycles.plot_id', 'plots.id')
      .where('crop_cycles.id', crop_cycle_id)
      .where('crop_cycles.plot_id', plot_id)
      .where('plots.farm_id', farm_id)
      .first();

    if (!cycle) {
      throw ApiError.notFound('Crop cycle not found');
    }
  }

  async #findOwnedIncome(user_id, farm_id, income_id) {
    const income = await db('farm_incomes').where({ id: income_id, farm_id, user_id }).first();

    if (!income) {
      throw ApiError.notFound('Income not found');
    }

    return income;
  }
}

module.exports = new IncomeService();
