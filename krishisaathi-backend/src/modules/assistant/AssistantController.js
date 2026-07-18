const Joi = require('joi');
const AssistantService = require('./AssistantService');
const ApiResponse = require('../../utils/ApiResponse');

class AssistantController {
  async getThread(req, res, next) {
    try {
      const result = await AssistantService.getThread(req.user.id);
      return ApiResponse.success(res, result);
    } catch (error) {
      return next(error);
    }
  }

  async chat(req, res, next) {
    try {
      const result = await AssistantService.chat(req.user.id, req.body.message, {
        farm_id: req.body.farm_id || null,
        plot_id: req.body.plot_id || null,
      });
      return ApiResponse.success(res, result, 'Reply generated');
    } catch (error) {
      return next(error);
    }
  }
}

const chat_schema = Joi.object({
  message: Joi.string().trim().min(1).max(4000).required(),
  farm_id: Joi.string().uuid().optional().allow(null, ''),
  plot_id: Joi.string().uuid().optional().allow(null, ''),
});

module.exports = {
  controller: new AssistantController(),
  chat_schema,
};
