export function normalizePhoneToE164(phone: string): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    const normalized = trimmed.replace(/[^\d+]/g, '');
    if (/^\+\d{7,15}$/.test(normalized)) return normalized;
    return null;
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  return null;
}
