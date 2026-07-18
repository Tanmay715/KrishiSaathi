const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const redis = require('../../config/redis');
const env = require('../../config/env');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const { generateOtp, normalizePhone, isValidIndianPhone } = require('../../utils/phone_utils');
const ActivityService = require('../activity/ActivityService');

const OTP_RATE_LIMIT_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

class AuthService {
  #otpRedisKey(phone) {
    return `otp:${phone}`;
  }

  #rateLimitRedisKey(phone) {
    return `otp_rate:${phone}`;
  }

  async #runRedis(command) {
    try {
      return await command();
    } catch (error) {
      console.error('[auth] redis error:', error.message);
      throw ApiError.serviceUnavailable('Auth service temporarily unavailable. Please try again.');
    }
  }

  async sendOtp(raw_phone) {
    const phone = normalizePhone(raw_phone);

    if (!phone || !isValidIndianPhone(phone)) {
      throw ApiError.badRequest('Enter a valid 10-digit Indian mobile number');
    }

    if (env.is_production && !env.sms_configured && !env.otp_pilot_mode) {
      throw ApiError.serviceUnavailable('OTP delivery is not configured yet');
    }

    const rate_key = this.#rateLimitRedisKey(phone);
    const is_rate_limited = await this.#runRedis(() => redis.get(rate_key));

    if (is_rate_limited) {
      throw ApiError.tooManyRequests('Please wait before requesting another OTP');
    }

    const otp = generateOtp(env.otp_length);
    const otp_key = this.#otpRedisKey(phone);

    await this.#runRedis(async () => {
      await redis.set(otp_key, JSON.stringify({ otp, attempts: 0 }), 'EX', env.otp_expiry_seconds);
      await redis.set(rate_key, '1', 'EX', OTP_RATE_LIMIT_SECONDS);
    });

    if (!env.is_production) {
      console.log(`[auth] OTP for ${phone}: ${otp}`);
    }

    const include_dev_otp = !env.is_production || env.otp_pilot_mode;

    return {
      phone,
      expires_in_seconds: env.otp_expiry_seconds,
      ...(include_dev_otp ? { dev_otp: otp } : {}),
    };
  }

  async verifyOtp(raw_phone, otp, profile = {}) {
    const phone = normalizePhone(raw_phone);

    if (!phone || !isValidIndianPhone(phone)) {
      throw ApiError.badRequest('Enter a valid 10-digit Indian mobile number');
    }

    const otp_key = this.#otpRedisKey(phone);
    const stored_value = await this.#runRedis(() => redis.get(otp_key));

    if (!stored_value) {
      throw ApiError.badRequest('OTP expired or not found. Please request a new OTP.');
    }

    const stored_data = JSON.parse(stored_value);

    if (stored_data.attempts >= MAX_OTP_ATTEMPTS) {
      await this.#runRedis(() => redis.del(otp_key));
      throw ApiError.tooManyRequests('Too many invalid attempts. Please request a new OTP.');
    }

    if (stored_data.otp !== String(otp).trim()) {
      stored_data.attempts += 1;
      await this.#runRedis(() => redis.set(
        otp_key,
        JSON.stringify(stored_data),
        'EX',
        env.otp_expiry_seconds,
      ));
      throw ApiError.badRequest('Invalid OTP');
    }

    await this.#runRedis(() => redis.del(otp_key));

    const user = await this.#findOrCreateUser(phone, profile);
    const token = this.#generateToken(user.id);

    await ActivityService.logActivity(user.id, 'login', 'User logged in', 'user', user.id);

    return { user: this.#sanitizeUser(user), token };
  }

  async #findOrCreateUser(phone, profile) {
    let user = await db('users').where({ phone }).first();

    if (!user) {
      const user_id = uuidv4();
      await db('users').insert({
        id: user_id,
        phone,
        name: profile.name || null,
        preferred_language: profile.preferred_language || 'en',
        preferred_land_unit: profile.preferred_land_unit || 'acre',
        state_code: profile.state_code || null,
        last_login_at: db.fn.now(),
      });
      user = await db('users').where({ id: user_id }).first();
    } else {
      await db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() });
      user = await db('users').where({ id: user.id }).first();
    }

    return user;
  }

  #generateToken(user_id) {
    return jwt.sign({ user_id }, env.jwt_secret, { expiresIn: env.jwt_expires_in });
  }

  #sanitizeUser(user) {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      preferred_language: user.preferred_language,
      preferred_land_unit: user.preferred_land_unit,
      state_code: user.state_code,
    };
  }
}

module.exports = new AuthService();
