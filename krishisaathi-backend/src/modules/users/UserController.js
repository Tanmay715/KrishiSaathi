const Joi = require('joi');
const { service } = require('./UserService');
const ApiResponse = require('../../utils/ApiResponse');

class UserController {
  async getProfile(req, res, next) {
    try {
      const user = await service.getProfile(req.user.id);
      return ApiResponse.success(res, user);
    } catch (error) {
      return next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const user = await service.updateProfile(req.user.id, req.body);
      return ApiResponse.success(res, user, 'Profile updated');
    } catch (error) {
      return next(error);
    }
  }

  async getLimits(req, res, next) {
    try {
      const limits = await service.getLimits(req.user.id);
      return ApiResponse.success(res, limits);
    } catch (error) {
      return next(error);
    }
  }

  async getProfileOverview(req, res, next) {
    try {
      const overview = await service.getProfileOverview(req.user.id);
      return ApiResponse.success(res, overview);
    } catch (error) {
      return next(error);
    }
  }
}

const update_profile_schema = Joi.object({
  name: Joi.string().max(120).optional(),
  preferred_language: Joi.string().valid('en', 'hi').optional(),
  preferred_land_unit: Joi.string().valid('acre', 'hectare', 'bigha').optional(),
  state_code: Joi.string().max(10).optional(),
}).min(1);

module.exports = {
  controller: new UserController(),
  update_profile_schema,
};
