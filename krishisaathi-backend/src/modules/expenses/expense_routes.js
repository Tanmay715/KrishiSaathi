const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const {
  controller,
  create_expense_schema,
  update_expense_schema,
  parse_expense_schema,
} = require('./ExpenseController');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', controller.list.bind(controller));
router.post('/parse', validateRequest(parse_expense_schema), controller.parse.bind(controller));
router.post('/', validateRequest(create_expense_schema), controller.create.bind(controller));
router.patch(
  '/:expense_id',
  validateRequest(update_expense_schema),
  controller.update.bind(controller),
);
router.delete('/:expense_id', controller.remove.bind(controller));

module.exports = router;
