const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const ExpenseService = require('../expenses/ExpenseService');
const IncomeService = require('../incomes/IncomeService');

class FarmFinanceService {
  async getSeasonFinance(user_id, farm_id, filters = {}) {
    const farm = await db('farms').where({ id: farm_id, user_id, is_active: true }).first();
    if (!farm) {
      throw ApiError.notFound('Farm not found');
    }

    const plots = await db('plots').where({ farm_id, is_active: true }).orderBy('created_at', 'asc');
    const plot_ids = plots.map((plot) => plot.id);
    const filter_options = await this.#getFilterOptions(plot_ids);
    const matching_crops = await this.#getMatchingCrops(plot_ids, filters);
    const cycle_ids = matching_crops.map((crop) => crop.id);

    const finance = await this.#summarizeMoney(user_id, farm_id, plot_ids, cycle_ids, filters);
    const crop_rows = await this.#buildCropRows(user_id, farm_id, matching_crops);
    const plot_rows = this.#buildPlotRows(plots, finance.plot_expenses, finance.plot_incomes);

    return {
      farm: { id: farm.id, name: farm.name, village: farm.village, district: farm.district, state: farm.state },
      filters: {
        season: filters.season || 'all',
        year: filters.year ? Number(filters.year) : 'all',
      },
      filter_options,
      finance: {
        expense_total: finance.expense_total,
        income_total: finance.income_total,
        profit: finance.income_total - finance.expense_total,
        expense_count: finance.expense_count,
        income_count: finance.income_count,
      },
      plots: plot_rows,
      crops: crop_rows,
    };
  }

  async #getFilterOptions(plot_ids) {
    if (!plot_ids.length) {
      return { seasons: [], years: [] };
    }

    const crops = await db('crop_cycles')
      .whereIn('plot_id', plot_ids)
      .select('season_type', 'sowing_date', 'actual_harvest_date', 'created_at');

    const seasons = [...new Set(crops.map((crop) => crop.season_type).filter(Boolean))];
    const years = [
      ...new Set(
        crops.map((crop) => {
          const date_value = crop.actual_harvest_date || crop.sowing_date || crop.created_at;
          return date_value ? new Date(date_value).getFullYear() : null;
        }).filter(Boolean),
      ),
    ].sort((a, b) => b - a);

    return { seasons, years };
  }

  async #getMatchingCrops(plot_ids, filters) {
    if (!plot_ids.length) {
      return [];
    }

    let query = db('crop_cycles').whereIn('plot_id', plot_ids);

    if (filters.season && filters.season !== 'all') {
      query = query.where('season_type', filters.season);
    }

    if (filters.year && filters.year !== 'all') {
      query = query.whereRaw(
        'YEAR(COALESCE(actual_harvest_date, sowing_date, created_at)) = ?',
        [Number(filters.year)],
      );
    }

    return query.orderBy('created_at', 'desc');
  }

  async #summarizeMoney(user_id, farm_id, plot_ids, cycle_ids, filters) {
    const is_filtered = (filters.season && filters.season !== 'all')
      || (filters.year && filters.year !== 'all');

    if (!is_filtered) {
      return this.#summarizeAllMoney(user_id, farm_id, plot_ids);
    }

    if (!cycle_ids.length) {
      return {
        expense_total: 0,
        expense_count: 0,
        income_total: 0,
        income_count: 0,
        plot_expenses: {},
        plot_incomes: {},
      };
    }

    return this.#summarizeCropMoney(user_id, farm_id, plot_ids, cycle_ids);
  }

  async #summarizeAllMoney(user_id, farm_id, plot_ids) {
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

    if (plot_ids.length) {
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

  async #summarizeCropMoney(user_id, farm_id, plot_ids, cycle_ids) {
    const expense_summary = await db('farm_expenses')
      .where({ farm_id, user_id })
      .whereIn('crop_cycle_id', cycle_ids)
      .sum('amount as total')
      .count('id as count')
      .first();

    const income_summary = await db('farm_incomes')
      .where({ farm_id, user_id })
      .whereIn('crop_cycle_id', cycle_ids)
      .sum('amount as total')
      .count('id as count')
      .first();

    const plot_expenses = {};
    const plot_incomes = {};

    const expense_rows = await db('farm_expenses')
      .where({ farm_id, user_id })
      .whereIn('plot_id', plot_ids)
      .whereIn('crop_cycle_id', cycle_ids)
      .select('plot_id')
      .sum('amount as total')
      .groupBy('plot_id');

    expense_rows.forEach((row) => {
      plot_expenses[row.plot_id] = Number(row.total || 0);
    });

    const income_rows = await db('farm_incomes')
      .where({ farm_id, user_id })
      .whereIn('plot_id', plot_ids)
      .whereIn('crop_cycle_id', cycle_ids)
      .select('plot_id')
      .sum('amount as total')
      .groupBy('plot_id');

    income_rows.forEach((row) => {
      plot_incomes[row.plot_id] = Number(row.total || 0);
    });

    return {
      expense_total: Number(expense_summary.total || 0),
      expense_count: Number(expense_summary.count || 0),
      income_total: Number(income_summary.total || 0),
      income_count: Number(income_summary.count || 0),
      plot_expenses,
      plot_incomes,
    };
  }

  async #buildCropRows(user_id, farm_id, crops) {
    if (!crops.length) {
      return [];
    }

    const cycle_ids = crops.map((crop) => crop.id);
    const [expense_totals, income_totals] = await Promise.all([
      ExpenseService.getTotalsByCropCycles(user_id, cycle_ids),
      IncomeService.getTotalsByCropCycles(user_id, cycle_ids),
    ]);

    const plot_names = await db('plots')
      .whereIn('id', crops.map((crop) => crop.plot_id))
      .select('id', 'name');

    const plot_map = Object.fromEntries(plot_names.map((plot) => [plot.id, plot.name]));

    return crops.map((crop) => {
      const expense_total = expense_totals[crop.id] || 0;
      const income_total = income_totals[crop.id] || 0;
      return {
        id: crop.id,
        crop_name: crop.crop_name,
        plot_id: crop.plot_id,
        plot_name: plot_map[crop.plot_id] || '—',
        season_type: crop.season_type,
        status: crop.status,
        sowing_date: crop.sowing_date,
        actual_harvest_date: crop.actual_harvest_date,
        expense_total,
        income_total,
        profit: income_total - expense_total,
      };
    });
  }

  #buildPlotRows(plots, plot_expenses, plot_incomes) {
    return plots.map((plot) => {
      const expense_total = plot_expenses[plot.id] || 0;
      const income_total = plot_incomes[plot.id] || 0;
      return {
        ...plot,
        expense_total,
        income_total,
        profit: income_total - expense_total,
      };
    });
  }
}

module.exports = new FarmFinanceService();
