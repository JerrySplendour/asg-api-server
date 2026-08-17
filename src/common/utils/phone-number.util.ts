import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';

/**
 * Normalizes any phone number into standard E.164 format (e.g., +2348012345678).
 * 
 * @param phone Raw phone number input string
 * @param defaultCountry Default ISO country code if missing country code prefix (defaults to 'NG')
 * @returns E.164 formatted string or sanitized fallback string
 */
export function normalizePhoneNumber(phone: string | undefined | null, defaultCountry: CountryCode = 'NG'): string {
  if (!phone) return '';

  const trimmed = phone.trim();
  if (!trimmed) return '';

  try {
    const phoneNumber = parsePhoneNumber(trimmed, defaultCountry);
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format('E.164');
    }
  } catch (e) {
    // Ignore parse error and fall back to manual normalization
  }

  // Fallback: Strip non-digits except leading +
  let cleaned = trimmed.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If starts with 0 and 11 digits (e.g. 08012345678 in Nigeria), convert to +234
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+234${cleaned.slice(1)}`;
  }

  // If 10 digits without leading 0 (e.g. 8012345678), convert to +234
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    return `+234${cleaned}`;
  }

  // If starts with 234 without +
  if (cleaned.startsWith('234')) {
    return `+${cleaned}`;
  }

  return `+${cleaned}`;
}
