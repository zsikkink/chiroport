const allowedOrigins = (() => {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
})();

const LOG_WINDOW_MS = 60 * 60 * 1000;
const originLogCache = new Map<string, number>();

function getEnvLabel() {
  return (
    Deno.env.get('FUNCTIONS_ENV') ||
    Deno.env.get('ENV') ||
    Deno.env.get('NODE_ENV') ||
    'development'
  );
}

function shouldLogOrigins(envLabel: string) {
  const normalized = envLabel.toLowerCase();
  return normalized === 'production' || normalized === 'prod' || normalized === 'staging' || normalized === 'stage';
}

function logOrigin(origin: string | null | undefined, path?: string | null) {
  const envLabel = getEnvLabel();
  if (!shouldLogOrigins(envLabel)) return;

  const safeOrigin = origin ?? 'none';
  const safePath = path ?? 'unknown';
  const cacheKey = `${envLabel}|${safeOrigin}|${safePath}`;
  const now = Date.now();
  const lastLogged = originLogCache.get(cacheKey);
  if (lastLogged && now - lastLogged < LOG_WINDOW_MS) {
    return;
  }
  originLogCache.set(cacheKey, now);

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'cors_origin_observed',
      origin: safeOrigin,
      path: safePath,
      environment: envLabel,
      observed_at: new Date(now).toISOString(),
    })
  );
}

function resolveOrigin(origin?: string | null) {
  if (allowedOrigins.length === 0) return '*';
  if (!origin) return allowedOrigins[0];
  return allowedOrigins.includes(origin) ? origin : 'null';
}

export function buildCorsHeaders(origin?: string | null, path?: string | null) {
  logOrigin(origin, path);
  return {
    'Access-Control-Allow-Origin': resolveOrigin(origin),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

export function withCorsHeaders(
  headers: Headers,
  origin?: string | null,
  path?: string | null
) {
  const corsHeaders = buildCorsHeaders(origin, path);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
}
