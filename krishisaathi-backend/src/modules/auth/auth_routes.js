const express = require('express');
const { controller, send_otp_schema, verify_otp_schema } = require('./AuthController');
const validateRequest = require('../../middleware/validate_request');
const authRateLimit = require('../../middleware/auth_rate_limit');

const router = express.Router();

router.post('/send-otp', authRateLimit, validateRequest(send_otp_schema), controller.sendOtp.bind(controller));
router.post('/verify-otp', authRateLimit, validateRequest(verify_otp_schema), controller.verifyOtp.bind(controller));

module.exports = router;
