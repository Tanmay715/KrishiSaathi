const { assertRateLimit } = require('../utils/rate_limit');

function getClientIp(req) {
  const vercel_forwarded = req.headers['x-vercel-forwarded-for'];
  if (typeof vercel_forwarded === 'string' && vercel_forwarded.length > 0) {
    return vercel_forwarded.split(',')[0].trim();
  }

  const real_ip = req.headers['x-real-ip'];
  if (typeof real_ip === 'string' && real_ip.length > 0) {
    return real_ip.trim();
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function authRateLimit(req, res, next) {
  try {
    const client_ip = getClientIp(req);
    // Pilot: many family members may share one Wi-Fi / Vercel edge path.
    await assertRateLimit({
      key: `auth_ip:${client_ip}`,
      limit: 120,
      window_seconds: 60,
      message: 'Too many login attempts. Please wait a minute and try again.',
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authRateLimit;
