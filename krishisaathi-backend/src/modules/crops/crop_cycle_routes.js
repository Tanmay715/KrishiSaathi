const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const {
  controller,
  create_crop_schema,
  update_crop_schema,
  harvest_schema,
  skip_sale_schema,
} = require('./CropCycleController');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/:plot_id/detail', controller.getPlotDetail.bind(controller));
router.post('/:plot_id/crop-cycles', validateRequest(create_crop_schema), controller.create.bind(controller));
router.patch(
  '/:plot_id/crop-cycles/:cycle_id',
  validateRequest(update_crop_schema),
  controller.update.bind(controller),
);
router.post(
  '/:plot_id/crop-cycles/:cycle_id/harvest',
  validateRequest(harvest_schema),
  controller.harvest.bind(controller),
);
router.post(
  '/:plot_id/crop-cycles/:cycle_id/skip-sale',
  validateRequest(skip_sale_schema),
  controller.skipSale.bind(controller),
);
router.delete('/:plot_id/crop-cycles/:cycle_id', controller.remove.bind(controller));

module.exports = router;
