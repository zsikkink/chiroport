export function normalizeLocationSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toLocationSlug(airportCode: string, code: string) {
  return `${normalizeLocationSegment(airportCode)}-${normalizeLocationSegment(
    code
  )}`;
}

