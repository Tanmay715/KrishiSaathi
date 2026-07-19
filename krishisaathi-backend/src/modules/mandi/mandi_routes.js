const express = require('express');
const authenticate = require('../../middleware/auth');
const { controller } = require('./MandiController');

const router = express.Router();

router.use(authenticate);

router.get('/commodities', controller.listCommodities.bind(controller));
router.get('/board', controller.getBoard.bind(controller));
router.get('/rates', controller.getRates.bind(controller));

module.exports = router;
