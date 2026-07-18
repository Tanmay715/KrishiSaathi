const { v4: uuidv4 } = require('uuid');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const ActivityService = require('../activity/ActivityService');
const { MAX_PLOTS_PER_USER } = require('../users/UserService');

class PlotService {
  async listPlots(user_id, farm_id) {
    await this.#ensureFarmOwnership(user_id, farm_id);

    return db('plots')
      .where({ farm_id, is_active: true })
      .orderBy('created_at', 'asc');
  }

  async createPlot(user_id, farm_id, payload) {
    const farm = await this.#ensureFarmOwnership(user_id, farm_id);
    await this.#ensurePlotLimit(user_id);

    const plot_id = uuidv4();
    await db('plots').insert({
      id: plot_id,
      farm_id,
      name: payload.name,
      area: payload.area,
      soil_type: payload.soil_type || null,
      notes: payload.notes || null,
    });

    await ActivityService.logActivity(
      user_id,
      'plot_created',
      `Created plot "${payload.name}" in farm "${farm.name}"`,
      'plot',
      plot_id,
    );

    return db('plots').where({ id: plot_id }).first();
  }

  async updatePlot(user_id, farm_id, plot_id, payload) {
    await this.#ensureFarmOwnership(user_id, farm_id);
    await this.#findOwnedPlot(farm_id, plot_id);

    const allowed_fields = ['name', 'area', 'soil_type', 'notes'];
    const updates = {};
    allowed_fields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates[field] = payload[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    await db('plots').where({ id: plot_id }).update(updates);
    return db('plots').where({ id: plot_id }).first();
  }

  async deletePlot(user_id, farm_id, plot_id) {
    await this.#ensureFarmOwnership(user_id, farm_id);
    const plot = await this.#findOwnedPlot(farm_id, plot_id);
    await db('plots').where({ id: plot_id }).update({ is_active: false });

    await ActivityService.logActivity(
      user_id,
      'plot_deleted',
      `Archived plot "${plot.name}"`,
      'plot',
      plot_id,
    );
  }

  async #ensureFarmOwnership(user_id, farm_id) {
    const farm = await db('farms').where({ id: farm_id, user_id, is_active: true }).first();

    if (!farm) {
      throw ApiError.notFound('Farm not found');
    }

    return farm;
  }

  async #findOwnedPlot(farm_id, plot_id) {
    const plot = await db('plots').where({ id: plot_id, farm_id, is_active: true }).first();

    if (!plot) {
      throw ApiError.notFound('Plot not found');
    }

    return plot;
  }

  async #ensurePlotLimit(user_id) {
    const result = await db('plots')
      .join('farms', 'plots.farm_id', 'farms.id')
      .where('farms.user_id', user_id)
      .where('plots.is_active', true)
      .count('plots.id as count')
      .first();

    if (Number(result.count) >= MAX_PLOTS_PER_USER) {
      throw ApiError.badRequest(`Maximum ${MAX_PLOTS_PER_USER} plots allowed per account`);
    }
  }
}

module.exports = new PlotService();
