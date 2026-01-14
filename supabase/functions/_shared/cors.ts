export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export function withCorsHeaders(headers: Headers) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
}
