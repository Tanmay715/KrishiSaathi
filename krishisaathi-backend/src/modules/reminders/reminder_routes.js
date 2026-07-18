const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const {
  controller,
  create_reminder_schema,
  update_reminder_schema,
} = require('./ReminderController');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list.bind(controller));
router.post('/', validateRequest(create_reminder_schema), controller.create.bind(controller));
router.post('/generate', controller.generate.bind(controller));
router.patch(
  '/:reminder_id',
  validateRequest(update_reminder_schema),
  controller.update.bind(controller),
);

module.exports = router;
