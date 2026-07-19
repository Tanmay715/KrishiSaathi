const { v4: uuidv4 } = require('uuid');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const ActivityService = require('../activity/ActivityService');
const PlotService = require('../plots/PlotService');
const ExpenseService = require('../expenses/ExpenseService');
const IncomeService = require('../incomes/IncomeService');

const ACTIVE_STATUSES = ['planned', 'active'];

class CropCycleService {
  async getPlotDetail(user_id, farm_id, plot_id) {
    const plot = await this.#getOwnedPlot(user_id, farm_id, plot_id);
    const active_crop = await this.#getActiveCrop(plot_id);
    const crop_history = await this.#getCropHistory(plot_id);
    const history_ids = crop_history.map((crop) => crop.id);
    const all_cycle_ids = [
      ...(active_crop ? [active_crop.id] : []),
      ...history_ids,
    ];

    const [expense_totals, income_totals] = await Promise.all([
      ExpenseService.getTotalsByCropCycles(user_id, all_cycle_ids),
      IncomeService.getTotalsByCropCycles(user_id, all_cycle_ids),
    ]);

    const all_plot_expenses = await ExpenseService.listPlotExpenses(user_id, farm_id, plot_id);
    const all_plot_incomes = await IncomeService.listPlotIncomes(user_id, farm_id, plot_id);

    // Current section: active crop entries + unlinked plot-level money (not past crops).
    // Past crop money stays under crop_history.
    const expenses = all_plot_expenses.filter((row) => {
      if (!row.crop_cycle_id) {
        return true;
      }

      return active_crop ? row.crop_cycle_id === active_crop.id : false;
    });
    const incomes = all_plot_incomes.filter((row) => {
      if (!row.crop_cycle_id) {
        return true;
      }

      return active_crop ? row.crop_cycle_id === active_crop.id : false;
    });

    const unlinked_expense_total = all_plot_expenses
      .filter((row) => !row.crop_cycle_id)
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const unlinked_income_total = all_plot_incomes
      .filter((row) => !row.crop_cycle_id)
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    let expense_total = unlinked_expense_total;
    let income_total = unlinked_income_total;

    if (active_crop) {
      active_crop.expense_total = expense_totals[active_crop.id] || 0;
      active_crop.income_total = income_totals[active_crop.id] || 0;
      active_crop.profit = active_crop.income_total - active_crop.expense_total;
      // Top finance cards stay crop-focused; unlinked rows still appear in the lists below.
      expense_total = active_crop.expense_total;
      income_total = active_crop.income_total;
    }

    const history_with_finance = [];

    for (const crop of crop_history) {
      const crop_expense_total = expense_totals[crop.id] || 0;
      const crop_income_total = income_totals[crop.id] || 0;
      const crop_expenses = await ExpenseService.listCropExpenses(user_id, farm_id, plot_id, crop.id);
      const crop_incomes = await IncomeService.listCropIncomes(user_id, farm_id, plot_id, crop.id);

      history_with_finance.push({
        ...crop,
        expense_total: crop_expense_total,
        income_total: crop_income_total,
        profit: crop_income_total - crop_expense_total,
        expenses: crop_expenses,
        incomes: crop_incomes,
      });
    }

    return {
      ...plot,
      active_crop,
      crop_history: history_with_finance,
      expenses,
      expense_total,
      incomes,
      income_total,
      unlinked_expense_total,
      unlinked_income_total,
    };
  }

  async createCropCycle(user_id, farm_id, plot_id, payload) {
    const plot = await this.#getOwnedPlot(user_id, farm_id, plot_id);
    const existing_active = await this.#getActiveCrop(plot_id);

    if (existing_active) {
      throw ApiError.badRequest('This plot already has an active crop. Harvest it before starting a new one.');
    }

    let lifecycle_stages = payload.lifecycle_stages || [];

    if (payload.crop_template_id) {
      const template = await db('crop_templates').where({ id: payload.crop_template_id, is_active: true }).first();

      if (!template) {
        throw ApiError.notFound('Crop template not found');
      }

      let default_stages = template.default_stages;
      if (typeof default_stages === 'string') {
        default_stages = JSON.parse(default_stages);
      }

      lifecycle_stages = (default_stages || []).map((stage) => ({
        name: stage,
        completed: false,
      }));
    }

    const cycle_id = uuidv4();
    const status = payload.sowing_date ? 'active' : 'planned';

    await db('crop_cycles').insert({
      id: cycle_id,
      plot_id,
      crop_template_id: payload.crop_template_id || null,
      crop_name: payload.crop_name,
      season_type: payload.season_type || 'custom',
      season_start_date: payload.season_start_date || null,
      season_end_date: payload.season_end_date || null,
      sowing_date: payload.sowing_date || null,
      expected_harvest_date: payload.expected_harvest_date || null,
      status,
      lifecycle_stages: JSON.stringify(lifecycle_stages),
      notes: payload.notes || null,
    });

    await ActivityService.logActivity(
      user_id,
      'crop_started',
      `Started crop "${payload.crop_name}" on plot "${plot.name}"`,
      'crop_cycle',
      cycle_id,
    );

    try {
      const ReminderService = require('../reminders/ReminderService');
      await ReminderService.generateReminders(user_id);
    } catch (error) {
      console.warn('[crop] reminder generate failed:', error.message);
    }

    return db('crop_cycles').where({ id: cycle_id }).first();
  }

  async updateCropCycle(user_id, farm_id, plot_id, cycle_id, payload) {
    await this.#getOwnedPlot(user_id, farm_id, plot_id);
    const cycle = await this.#findOwnedCycle(plot_id, cycle_id);

    if (cycle.status === 'harvested' || cycle.status === 'abandoned') {
      throw ApiError.badRequest('Cannot update a completed crop cycle');
    }

    const allowed_fields = [
      'crop_name',
      'season_type',
      'season_start_date',
      'season_end_date',
      'sowing_date',
      'expected_harvest_date',
      'lifecycle_stages',
      'notes',
      'status',
    ];

    const updates = {};
    allowed_fields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates[field] = payload[field];
      }
    });

    if (payload.sowing_date && !updates.status) {
      updates.status = 'active';
    }

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    if (updates.lifecycle_stages) {
      updates.lifecycle_stages = JSON.stringify(updates.lifecycle_stages);
    }

    await db('crop_cycles').where({ id: cycle_id }).update(updates);
    return db('crop_cycles').where({ id: cycle_id }).first();
  }

  async recordHarvest(user_id, farm_id, plot_id, cycle_id, payload) {
    const plot = await this.#getOwnedPlot(user_id, farm_id, plot_id);
    const cycle = await this.#findOwnedCycle(plot_id, cycle_id);

    if (cycle.status === 'harvested') {
      throw ApiError.badRequest('Crop already marked as harvested');
    }

    await db('crop_cycles').where({ id: cycle_id }).update({
      status: 'harvested',
      actual_harvest_date: payload.actual_harvest_date || new Date().toISOString().slice(0, 10),
      notes: payload.notes ?? cycle.notes,
    });

    await ActivityService.logActivity(
      user_id,
      'crop_harvested',
      `Harvested "${cycle.crop_name}" on plot "${plot.name}"`,
      'crop_cycle',
      cycle_id,
    );

    return db('crop_cycles').where({ id: cycle_id }).first();
  }

  async skipSaleIncome(user_id, farm_id, plot_id, cycle_id, payload = {}) {
    await this.#getOwnedPlot(user_id, farm_id, plot_id);
    const cycle = await this.#findOwnedCycle(plot_id, cycle_id);

    if (cycle.status !== 'harvested') {
      throw ApiError.badRequest('Only harvested crops can skip sale income');
    }

    const track_expenses = payload.track_expenses !== false;

    await db('crop_cycles').where({ id: cycle_id }).update({
      skip_sale_income: true,
      track_expenses,
    });

    return db('crop_cycles').where({ id: cycle_id }).first();
  }

  async deleteCropCycle(user_id, farm_id, plot_id, cycle_id) {
    const plot = await this.#getOwnedPlot(user_id, farm_id, plot_id);
    const cycle = await this.#findOwnedCycle(plot_id, cycle_id);

    if (!['harvested', 'abandoned'].includes(cycle.status)) {
      throw ApiError.badRequest('Only completed crops can be removed from history');
    }

    await db.transaction(async (trx) => {
      await trx('farm_expenses').where({ crop_cycle_id: cycle_id, user_id }).del();
      await trx('farm_incomes').where({ crop_cycle_id: cycle_id, user_id }).del();
      await trx('crop_cycles').where({ id: cycle_id }).del();
    });

    await ActivityService.logActivity(
      user_id,
      'crop_deleted',
      `Removed "${cycle.crop_name}" from plot "${plot.name}" history`,
      'crop_cycle',
      cycle_id,
    );
  }

  async #getOwnedPlot(user_id, farm_id, plot_id) {
    await PlotService.listPlots(user_id, farm_id);
    const plot = await db('plots').where({ id: plot_id, farm_id, is_active: true }).first();

    if (!plot) {
      throw ApiError.notFound('Plot not found');
    }

    return plot;
  }

  async #findOwnedCycle(plot_id, cycle_id) {
    const cycle = await db('crop_cycles').where({ id: cycle_id, plot_id }).first();

    if (!cycle) {
      throw ApiError.notFound('Crop cycle not found');
    }

    return cycle;
  }

  async #getActiveCrop(plot_id) {
    const cycle = await db('crop_cycles')
      .where({ plot_id })
      .whereIn('status', ACTIVE_STATUSES)
      .orderBy('created_at', 'desc')
      .first();

    return cycle ? this.#formatCycle(cycle) : null;
  }

  async #getCropHistory(plot_id) {
    const cycles = await db('crop_cycles')
      .where({ plot_id })
      .whereIn('status', ['harvested', 'abandoned'])
      .orderBy('created_at', 'desc');

    return cycles.map((cycle) => this.#formatCycle(cycle));
  }

  #formatCycle(cycle) {
    let lifecycle_stages = cycle.lifecycle_stages;
    if (typeof lifecycle_stages === 'string') {
      lifecycle_stages = JSON.parse(lifecycle_stages);
    }

    return {
      ...cycle,
      lifecycle_stages: lifecycle_stages || [],
    };
  }
}

module.exports = new CropCycleService();
