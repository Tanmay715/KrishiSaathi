const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const { controller, create_income_schema, update_income_schema } = require('./IncomeController');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', controller.list.bind(controller));
router.post('/', validateRequest(create_income_schema), controller.create.bind(controller));
router.patch(
  '/:income_id',
  validateRequest(update_income_schema),
  controller.update.bind(controller),
);
router.delete('/:income_id', controller.remove.bind(controller));

module.exports = router;
