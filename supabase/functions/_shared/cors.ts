const allowedOrigins = (() => {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
})();

function resolveOrigin(origin?: string | null) {
  if (allowedOrigins.length === 0) return '*';
  if (!origin) return allowedOrigins[0];
  return allowedOrigins.includes(origin) ? origin : 'null';
}

export function buildCorsHeaders(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(origin),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

export function withCorsHeaders(headers: Headers, origin?: string | null) {
  const corsHeaders = buildCorsHeaders(origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
}
