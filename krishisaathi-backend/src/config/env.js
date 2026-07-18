require('dotenv').config();

function parseCorsOrigins(value) {
  return String(value || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const env = {
  node_env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  api_prefix: process.env.API_PREFIX || '/api/v1',
  jwt_secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwt_expires_in: process.env.JWT_EXPIRES_IN || '7d',
  otp_expiry_seconds: Number(process.env.OTP_EXPIRY_SECONDS || 300),
  otp_length: Number(process.env.OTP_LENGTH || 6),
  otp_pilot_mode: process.env.OTP_PILOT_MODE === 'true',
  sms_provider: process.env.SMS_PROVIDER || '',
  cors_origin: parseCorsOrigins(process.env.CORS_ORIGIN),
  openai_api_key: process.env.OPENAI_API_KEY || '',
  openai_model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  is_production: process.env.NODE_ENV === 'production',
};

env.sms_configured = Boolean(env.sms_provider);

function validateProductionEnv() {
  if (!env.is_production) {
    return;
  }

  const weak_secret = !process.env.JWT_SECRET || env.jwt_secret === 'dev-secret-change-me';
  if (weak_secret) {
    throw new Error('JWT_SECRET must be set to a strong random value in production');
  }

  const has_localhost_cors = env.cors_origin.some((origin) => origin.includes('localhost'));
  if (has_localhost_cors) {
    throw new Error('CORS_ORIGIN must include your production frontend URL, not localhost');
  }

  if (!env.sms_configured && !env.otp_pilot_mode) {
    throw new Error('Set SMS_PROVIDER or OTP_PILOT_MODE=true for closed pilot before production');
  }
}

validateProductionEnv();

module.exports = env;
