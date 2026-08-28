import { parsePhoneNumberFromString } from 'npm:libphonenumber-js';

export function normalizePhoneToE164(phone: string): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();

  if (trimmed.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(trimmed);
    return parsed?.isValid() ? parsed.number : null;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  const parsed = parsePhoneNumberFromString(digitsOnly, 'US');
  return parsed?.isValid() ? parsed.number : null;
}
