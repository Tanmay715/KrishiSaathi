const crypto = require('crypto');

function generateOtp(length = 6) {
  const max = 10 ** length;
  const otp = crypto.randomInt(0, max);
  return String(otp).padStart(length, '0');
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  return null;
}

function isValidIndianPhone(phone) {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

module.exports = {
  generateOtp,
  normalizePhone,
  isValidIndianPhone,
};
