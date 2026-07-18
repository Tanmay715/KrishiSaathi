const redis = require('../config/redis');
const env = require('../config/env');
const ApiError = require('./ApiError');

async function assertRateLimit({ key, limit, window_seconds, message }) {
  const redis_key = `rate:${key}`;

  try {
    if (redis.status !== 'ready') {
      await redis.connect().catch(() => null);
    }

    const count = await redis.incr(redis_key);

    if (count === 1) {
      await redis.expire(redis_key, window_seconds);
    }

    if (count > limit) {
      throw ApiError.tooManyRequests(message || 'Too many requests. Please try again later.');
    }
  } catch (error) {
    if (error.status_code) {
      throw error;
    }

    console.error('[rate_limit]', error.message);

    // Pilot mode: never block login because Redis blipped.
    if (env.is_production && !env.otp_pilot_mode) {
      throw ApiError.serviceUnavailable('Rate limiting unavailable. Please try again shortly.');
    }
  }
}

module.exports = {
  assertRateLimit,
};
