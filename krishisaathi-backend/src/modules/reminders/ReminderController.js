const Joi = require('joi');
const ReminderService = require('./ReminderService');
const ApiResponse = require('../../utils/ApiResponse');

class ReminderController {
  async list(req, res, next) {
    try {
      const reminders = await ReminderService.listReminders(req.user.id, {
        farm_id: req.query.farm_id || null,
        status: req.query.status || 'pending',
      });
      return ApiResponse.success(res, reminders);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const reminder = await ReminderService.createReminder(req.user.id, req.body);
      return ApiResponse.created(res, reminder, 'Reminder created');
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const reminder = await ReminderService.updateReminder(
        req.user.id,
        req.params.reminder_id,
        req.body,
      );
      return ApiResponse.success(res, reminder, 'Reminder updated');
    } catch (error) {
      return next(error);
    }
  }

  async generate(req, res, next) {
    try {
      const reminders = await ReminderService.generateReminders(req.user.id);
      return ApiResponse.success(res, reminders, 'Reminders generated');
    } catch (error) {
      return next(error);
    }
  }
}

const create_reminder_schema = Joi.object({
  farm_id: Joi.string().uuid().optional().allow(null),
  plot_id: Joi.string().uuid().optional().allow(null),
  crop_cycle_id: Joi.string().uuid().optional().allow(null),
  type: Joi.string()
    .valid('irrigation', 'fertilizer', 'pesticide', 'harvest', 'weather', 'custom')
    .default('custom'),
  title: Joi.string().max(200).required(),
  due_at: Joi.date().iso().required(),
  payload: Joi.object().optional(),
});

const update_reminder_schema = Joi.object({
  status: Joi.string().valid('pending', 'done', 'dismissed').optional(),
  title: Joi.string().max(200).optional(),
  due_at: Joi.date().iso().optional(),
  type: Joi.string()
    .valid('irrigation', 'fertilizer', 'pesticide', 'harvest', 'weather', 'custom')
    .optional(),
}).min(1);

module.exports = {
  controller: new ReminderController(),
  create_reminder_schema,
  update_reminder_schema,
};
