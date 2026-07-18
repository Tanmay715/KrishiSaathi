const Joi = require('joi');
const CropTemplateService = require('./CropTemplateService');
const ApiResponse = require('../../utils/ApiResponse');

class CropTemplateController {
  async list(req, res, next) {
    try {
      const language = req.query.language || req.user?.preferred_language || 'en';
      const templates = await CropTemplateService.listTemplates(language);
      return ApiResponse.success(res, templates);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = {
  controller: new CropTemplateController(),
};
