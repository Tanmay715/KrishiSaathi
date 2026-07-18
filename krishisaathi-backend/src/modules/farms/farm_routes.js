const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const { controller, create_farm_schema, update_farm_schema } = require('./FarmController');

const router = express.Router();

router.use(authenticate);

router.get('/quick-log/targets', controller.quickLogTargets.bind(controller));
router.get('/', controller.list.bind(controller));
router.post('/', validateRequest(create_farm_schema), controller.create.bind(controller));
router.get('/:farm_id', controller.getById.bind(controller));
router.patch('/:farm_id', validateRequest(update_farm_schema), controller.update.bind(controller));
router.delete('/:farm_id', controller.remove.bind(controller));

module.exports = router;
