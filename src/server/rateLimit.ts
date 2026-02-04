import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

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

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) return first.trim();
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export async function checkRateLimit(
  rules: RateLimitRule[],
  options?: { failOpen?: boolean; context?: Record<string, unknown> }
) {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const normalized = rules
    .filter((rule) => rule.bucket && rule.limit > 0 && rule.windowSeconds > 0)
    .map((rule) => ({
      bucket: rule.bucket,
      limit: rule.limit,
      window_seconds: rule.windowSeconds,
    }));

  if (!normalized.length) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await (supabase as typeof supabase & {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        data: unknown;
        error: { message?: string } | null;
      }>;
    }).rpc('check_rate_limits', {
      p_rules: normalized,
    });
    if (error) {
      console.error('[rate_limit] rpc failed', error);
      if (options?.failOpen ?? true) {
        return { allowed: true, retryAfterSeconds: 0 };
      }
      return { allowed: false, retryAfterSeconds: 30 };
    }

    const rows = (data ?? []) as RateLimitRow[];
    const blocked = rows.filter((row) => row.allowed === false);
    if (blocked.length === 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const now = Date.now();
    const retryAfterSeconds = blocked.reduce((min, row) => {
      const reset = new Date(row.reset_at).getTime();
      const seconds = Math.max(1, Math.ceil((reset - now) / 1000));
      return Math.min(min, seconds);
    }, Number.POSITIVE_INFINITY);

    console.warn('[rate_limit] blocked', {
      retryAfterSeconds,
      buckets: blocked.map((row) => ({
        bucket: row.bucket_key,
        limit: row.limit_count,
        remaining: row.remaining,
        reset_at: row.reset_at,
      })),
      context: options?.context,
    });

    return { allowed: false, retryAfterSeconds };
  } catch (error) {
    console.error('[rate_limit] failed', error);
    if (options?.failOpen ?? true) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    return { allowed: false, retryAfterSeconds: 30 };
  }
}

export function rateLimitResponse(retryAfterSeconds: number) {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    {
      error: {
        code: 'rate_limited',
        message: 'Too many requests. Please try again later.',
        retry_after: retryAfter,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
