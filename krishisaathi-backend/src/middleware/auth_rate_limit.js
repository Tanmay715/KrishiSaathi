const { assertRateLimit } = require('../utils/rate_limit');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function authRateLimit(req, res, next) {
  try {
    const client_ip = getClientIp(req);
    await assertRateLimit({
      key: `auth_ip:${client_ip}`,
      limit: 10,
      window_seconds: 60,
      message: 'Too many login attempts from this device. Please wait a minute.',
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authRateLimit;
