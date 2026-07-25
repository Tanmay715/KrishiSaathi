const express = require('express');
const authenticate = require('../../middleware/auth');
const validateRequest = require('../../middleware/validate_request');
const { controller, voice_command_schema } = require('./VoiceCommandController');

const router = express.Router();

router.use(authenticate);

router.post('/command', validateRequest(voice_command_schema), controller.interpret.bind(controller));

module.exports = router;
