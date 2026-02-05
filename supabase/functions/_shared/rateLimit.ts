import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1?target=deno';
import { withCorsHeaders } from './cors.ts';

export type RateLimitRule = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitRow = {
  bucket_key: string;
  allowed: boolean;
  remaining: number;
  reset_at: string;
  limit_count: number;
  window_seconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  rows: RateLimitRow[];
};

export function getRateLimitConfig(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function buildRateLimitResponse(params: {
  retryAfterSeconds: number;
  message?: string;
  headers?: Headers;
  origin?: string | null;
}) {
  const retryAfter = Math.max(1, Math.ceil(params.retryAfterSeconds));
  const headers = params.headers ?? new Headers();
  headers.set('Retry-After', retryAfter.toString());
  withCorsHeaders(headers, params.origin);
  return new Response(
    JSON.stringify({
      error: {
        code: 'rate_limited',
        message: params.message ?? 'Too many requests. Please try again later.',
        retry_after: retryAfter,
      },
    }),
    { status: 429, headers }
  );
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  rules: RateLimitRule[],
  options?: { endpoint?: string; failOpen?: boolean; logContext?: Record<string, unknown> }
): Promise<RateLimitResult> {
  const normalized = rules
    .filter((rule) => rule.bucket && rule.limit > 0 && rule.windowSeconds > 0)
    .map((rule) => ({
      bucket: rule.bucket,
      limit: rule.limit,
      window_seconds: rule.windowSeconds,
    }));

  if (!normalized.length) {
    return { allowed: true, retryAfterSeconds: 0, rows: [] };
  }

  const { data, error } = await supabase.rpc('check_rate_limits', {
    p_rules: normalized,
  });

  if (error) {
    console.error('[rate_limit] rpc failed', {
      endpoint: options?.endpoint,
      error,
      rules: normalized,
    });
    if (options?.failOpen ?? true) {
      return { allowed: true, retryAfterSeconds: 0, rows: [] };
    }
    return { allowed: false, retryAfterSeconds: 30, rows: [] };
  }

  const rows = (data ?? []) as RateLimitRow[];
  const blocked = rows.filter((row) => row.allowed === false);
  if (blocked.length === 0) {
    return { allowed: true, retryAfterSeconds: 0, rows };
  }

  const now = Date.now();
  const retryAfterSeconds = blocked.reduce((min, row) => {
    const reset = new Date(row.reset_at).getTime();
    const seconds = Math.max(1, Math.ceil((reset - now) / 1000));
    return Math.min(min, seconds);
  }, Number.POSITIVE_INFINITY);

  console.warn('[rate_limit] blocked', {
    endpoint: options?.endpoint,
    retryAfterSeconds,
    buckets: blocked.map((row) => ({
      bucket: row.bucket_key,
      limit: row.limit_count,
      remaining: row.remaining,
      reset_at: row.reset_at,
    })),
    context: options?.logContext,
  });

  return { allowed: false, retryAfterSeconds, rows };
}
