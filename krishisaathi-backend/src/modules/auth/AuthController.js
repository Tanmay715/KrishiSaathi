const Joi = require('joi');
const AuthService = require('./AuthService');
const ApiResponse = require('../../utils/ApiResponse');
const env = require('../../config/env');

class AuthController {
  async sendOtp(req, res, next) {
    try {
      const result = await AuthService.sendOtp(req.body.phone);
      return ApiResponse.success(res, result, 'OTP sent successfully');
    } catch (error) {
      return next(error);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const result = await AuthService.verifyOtp(req.body.phone, req.body.otp, {
        name: req.body.name,
        preferred_language: req.body.preferred_language,
        preferred_land_unit: req.body.preferred_land_unit,
        state_code: req.body.state_code,
      });
      return ApiResponse.success(res, result, 'Login successful');
    } catch (error) {
      return next(error);
    }
  }
}

const send_otp_schema = Joi.object({
  phone: Joi.string().required(),
});

const verify_otp_schema = Joi.object({
  phone: Joi.string().required(),
  otp: Joi.string().length(env.otp_length).required(),
  name: Joi.string().max(120).optional(),
  preferred_language: Joi.string().valid('en', 'hi').optional(),
  preferred_land_unit: Joi.string().valid('acre', 'hectare', 'bigha').optional(),
  state_code: Joi.string().max(10).optional(),
});

module.exports = {
  controller: new AuthController(),
  send_otp_schema,
  verify_otp_schema,
};
