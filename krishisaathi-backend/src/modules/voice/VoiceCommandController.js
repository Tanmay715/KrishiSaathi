const Joi = require('joi');
const VoiceCommandService = require('./VoiceCommandService');
const ApiResponse = require('../../utils/ApiResponse');

class VoiceCommandController {
  async interpret(req, res, next) {
    try {
      const turn = await VoiceCommandService.interpret(req.user.id, req.body);
      return ApiResponse.success(res, turn);
    } catch (error) {
      return next(error);
    }
  }
}

const voice_draft_schema = Joi.object({
  title: Joi.string().max(150).allow('', null),
  category: Joi.string().max(40).allow('', null),
  amount: Joi.number().allow(null),
  quantity: Joi.number().allow(null),
  unit: Joi.string().max(40).allow('', null),
  date: Joi.string().max(30).allow('', null),
  due_at: Joi.string().max(30).allow('', null),
  reminder_type: Joi.string().max(40).allow('', null),
  target_key: Joi.string().max(80).allow('', null),
  notes: Joi.string().max(500).allow('', null),
}).unknown(false);

const voice_command_schema = Joi.object({
  transcript: Joi.string().min(1).max(2000).required(),
  language: Joi.string().valid('en', 'hi').optional(),
  intent: Joi.string()
    .valid('expense', 'income', 'reminder', 'assistant', 'help', 'unknown')
    .optional()
    .allow(null),
  draft: voice_draft_schema.optional(),
});

module.exports = {
  controller: new VoiceCommandController(),
  voice_command_schema,
};
