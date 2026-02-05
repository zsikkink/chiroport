import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { createServiceRoleClient } from '../_shared/supabaseClient.ts';
import { sendClaimedMessage } from '../_shared/outbox.ts';
import { requireEnv } from '../_shared/env.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) return first.trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return 'unknown';
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const internalSecret = Deno.env.get('SEND_SMS_SECRET');
  const providedSecret =
    req.headers.get('x-internal-secret') || req.headers.get('x-sms-secret');
  const authHeader = req.headers.get('authorization');
  const apiKey = req.headers.get('apikey');
  const bearerToken = authHeader?.replace(/^Bearer\\s+/i, '');

  const hasInternalSecret =
    Boolean(internalSecret) && providedSecret === internalSecret;
  const hasServiceRole =
    bearerToken === serviceRoleKey || apiKey === serviceRoleKey;

  if (!hasInternalSecret && !hasServiceRole) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }

  const supabase = createServiceRoleClient();
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(
    supabase,
    [
      {
        bucket: `ip:${ip}`,
        limit: getRateLimitConfig('RATE_LIMIT_SEND_SMS_IP_PER_MIN', 10),
        windowSeconds: 60,
      },
    ],
    { endpoint: 'send_sms', logContext: { ip } }
  );

  if (!rateLimit.allowed) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return buildRateLimitResponse({
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      headers,
      origin,
    });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = Math.max(1, Math.min(Number(limitParam ?? 25), 100));

  const { data: queued, error } = await supabase.rpc('claim_sms_outbox', {
    p_limit: limit,
    p_lock_minutes: 5,
  });

  if (error) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Failed to load outbox' }), {
      status: 500,
      headers,
    });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const message of queued ?? []) {
    const result = await sendClaimedMessage(supabase, message);
    results.push({
      id: message.id,
      status: result.status,
      error: result.status === 'failed' ? result.error : undefined,
    });
  }

  const headers = new Headers();
  withCorsHeaders(headers, origin);
  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200,
    headers,
  });
});
