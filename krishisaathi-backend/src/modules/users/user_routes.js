const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const { controller, update_profile_schema } = require('./UserController');

const router = express.Router();

router.use(authenticate);

router.get('/me', controller.getProfile.bind(controller));
router.get('/me/overview', controller.getProfileOverview.bind(controller));
router.patch('/me', validateRequest(update_profile_schema), controller.updateProfile.bind(controller));
router.get('/limits', controller.getLimits.bind(controller));

module.exports = router;
