export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function hasValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
