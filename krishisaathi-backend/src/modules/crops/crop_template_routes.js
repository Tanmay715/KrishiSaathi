const express = require('express');
const authenticate = require('../../middleware/auth');
const { controller } = require('./CropTemplateController');

const router = express.Router();

router.use(authenticate);
router.get('/', controller.list.bind(controller));

module.exports = router;
