const Joi = require('joi');
const CropCycleService = require('./CropCycleService');
const ApiResponse = require('../../utils/ApiResponse');

class CropCycleController {
  async getPlotDetail(req, res, next) {
    try {
      const plot = await CropCycleService.getPlotDetail(
        req.user.id,
        req.params.farm_id,
        req.params.plot_id,
      );
      return ApiResponse.success(res, plot);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const cycle = await CropCycleService.createCropCycle(
        req.user.id,
        req.params.farm_id,
        req.params.plot_id,
        req.body,
      );
      return ApiResponse.created(res, cycle, 'Crop started');
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const cycle = await CropCycleService.updateCropCycle(
        req.user.id,
        req.params.farm_id,
        req.params.plot_id,
        req.params.cycle_id,
        req.body,
      );
      return ApiResponse.success(res, cycle, 'Crop updated');
    } catch (error) {
      return next(error);
    }
  }

  async harvest(req, res, next) {
    try {
      const cycle = await CropCycleService.recordHarvest(
        req.user.id,
        req.params.farm_id,
        req.params.plot_id,
        req.params.cycle_id,
        req.body,
      );
      return ApiResponse.success(res, cycle, 'Harvest recorded');
    } catch (error) {
      return next(error);
    }
  }

  async skipSale(req, res, next) {
    try {
      const cycle = await CropCycleService.skipSaleIncome(
        req.user.id,
        req.params.farm_id,
        req.params.plot_id,
        req.params.cycle_id,
        req.body,
      );
      return ApiResponse.success(res, cycle, 'Sale income skipped');
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await CropCycleService.deleteCropCycle(
        req.user.id,
        req.params.farm_id,
        req.params.plot_id,
        req.params.cycle_id,
      );
      return ApiResponse.success(res, null, 'Crop removed from history');
    } catch (error) {
      return next(error);
    }
  }
}

const create_crop_schema = Joi.object({
  crop_template_id: Joi.string().uuid().optional(),
  crop_name: Joi.string().max(150).required(),
  season_type: Joi.string().valid('rabi', 'kharif', 'zaid', 'custom').optional(),
  season_start_date: Joi.date().iso().optional().allow(null),
  season_end_date: Joi.date().iso().optional().allow(null),
  sowing_date: Joi.date().iso().optional().allow(null),
  expected_harvest_date: Joi.date().iso().optional().allow(null),
  notes: Joi.string().allow('', null).optional(),
});

const update_crop_schema = create_crop_schema
  .fork(['crop_name'], (schema) => schema.optional())
  .keys({
    lifecycle_stages: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required(),
          completed: Joi.boolean().required(),
        }),
      )
      .optional(),
    status: Joi.string().valid('planned', 'active', 'abandoned').optional(),
  })
  .min(1);

const harvest_schema = Joi.object({
  actual_harvest_date: Joi.date().iso().optional(),
  notes: Joi.string().allow('', null).optional(),
});

const skip_sale_schema = Joi.object({
  track_expenses: Joi.boolean().optional(),
});

module.exports = {
  controller: new CropCycleController(),
  create_crop_schema,
  update_crop_schema,
  harvest_schema,
  skip_sale_schema,
};
