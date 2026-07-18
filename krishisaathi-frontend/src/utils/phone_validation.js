const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export function normalizeIndianMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function isValidIndianMobile(phone) {
  return INDIAN_MOBILE_REGEX.test(normalizeIndianMobile(phone));
}

export { INDIAN_MOBILE_REGEX };
