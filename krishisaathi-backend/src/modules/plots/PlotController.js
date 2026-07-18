const Joi = require('joi');
const PlotService = require('./PlotService');
const ApiResponse = require('../../utils/ApiResponse');

class PlotController {
  async list(req, res, next) {
    try {
      const plots = await PlotService.listPlots(req.user.id, req.params.farm_id);
      return ApiResponse.success(res, plots);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const plot = await PlotService.createPlot(req.user.id, req.params.farm_id, req.body);
      return ApiResponse.created(res, plot, 'Plot created');
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const plot = await PlotService.updatePlot(
        req.user.id,
        req.params.farm_id,
        req.params.plot_id,
        req.body,
      );
      return ApiResponse.success(res, plot, 'Plot updated');
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await PlotService.deletePlot(req.user.id, req.params.farm_id, req.params.plot_id);
      return ApiResponse.success(res, null, 'Plot archived');
    } catch (error) {
      return next(error);
    }
  }
}

const create_plot_schema = Joi.object({
  name: Joi.string().max(150).required(),
  area: Joi.number().positive().required(),
  soil_type: Joi.string().max(80).optional(),
  notes: Joi.string().allow('', null).optional(),
});

const update_plot_schema = create_plot_schema.fork(['name', 'area'], (schema) => schema.optional()).min(1);

module.exports = {
  controller: new PlotController(),
  create_plot_schema,
  update_plot_schema,
};
