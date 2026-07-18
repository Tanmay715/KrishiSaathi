const Joi = require('joi');
const FarmService = require('./FarmService');
const ApiResponse = require('../../utils/ApiResponse');

class FarmController {
  async list(req, res, next) {
    try {
      const farms = await FarmService.listFarms(req.user.id);
      return ApiResponse.success(res, farms);
    } catch (error) {
      return next(error);
    }
  }

  async quickLogTargets(req, res, next) {
    try {
      const targets = await FarmService.getQuickLogTargets(req.user.id);
      return ApiResponse.success(res, targets);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const farm = await FarmService.getFarmById(req.user.id, req.params.farm_id);
      return ApiResponse.success(res, farm);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const farm = await FarmService.createFarm(req.user.id, req.body);
      return ApiResponse.created(res, farm, 'Farm created');
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const farm = await FarmService.updateFarm(req.user.id, req.params.farm_id, req.body);
      return ApiResponse.success(res, farm, 'Farm updated');
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await FarmService.deleteFarm(req.user.id, req.params.farm_id);
      return ApiResponse.success(res, null, 'Farm archived');
    } catch (error) {
      return next(error);
    }
  }
}

const create_farm_schema = Joi.object({
  name: Joi.string().max(150).required(),
  state: Joi.string().max(100).optional(),
  district: Joi.string().max(100).optional(),
  village: Joi.string().max(150).optional(),
  total_area: Joi.number().min(0).optional(),
  notes: Joi.string().allow('', null).optional(),
});

const update_farm_schema = create_farm_schema.fork(['name'], (schema) => schema.optional()).min(1);

module.exports = {
  controller: new FarmController(),
  create_farm_schema,
  update_farm_schema,
};
