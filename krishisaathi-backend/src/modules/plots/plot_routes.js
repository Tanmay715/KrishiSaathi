const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const { controller, create_plot_schema, update_plot_schema } = require('./PlotController');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', controller.list.bind(controller));
router.post('/', validateRequest(create_plot_schema), controller.create.bind(controller));
router.patch('/:plot_id', validateRequest(update_plot_schema), controller.update.bind(controller));
router.delete('/:plot_id', controller.remove.bind(controller));

module.exports = router;
