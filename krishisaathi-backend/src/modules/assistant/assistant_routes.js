const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const { controller, chat_schema } = require('./AssistantController');

const router = express.Router();

router.use(authenticate);

router.get('/thread', controller.getThread.bind(controller));
router.post('/chat', validateRequest(chat_schema), controller.chat.bind(controller));

module.exports = router;
