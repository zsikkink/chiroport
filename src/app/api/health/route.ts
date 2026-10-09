import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/server';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/server/rateLimit';

function errorResponse(
  code: 'unauthorized' | 'not_found' | 'internal_error' | 'validation_error',
  message: string,
  status: number
) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Compatibility liveness endpoint. It deliberately checks only that the
 * process can respond and reports configuration presence; it does not claim
 * that Supabase, Realtime, cron, or Twilio are reachable.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = await checkRateLimit(
      [
        {
          bucket: `ip:${ip}:health`,
          limit: Number(process.env.RATE_LIMIT_HEALTH_PER_MIN ?? 60),
          windowSeconds: 60,
        },
      ],
      { context: { ip, path: '/api/health' } }
    );
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

    const providedSecret = request.headers.get('x-health-secret');
    if (env.NODE_ENV === 'production' && !env.HEALTH_CHECK_SECRET) {
      return errorResponse('not_found', 'Not found', 404);
    }
    if (
      env.HEALTH_CHECK_SECRET &&
      providedSecret !== env.HEALTH_CHECK_SECRET
    ) {
      return errorResponse('unauthorized', 'Unauthorized', 401);
    }

    const supabaseConfigured = Boolean(
      env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const twilioConfigured = Boolean(
      env.TWILIO_ACCOUNT_SID &&
        (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM_NUMBER)
    );

    return NextResponse.json({
      success: true,
      data: {
        status: 'live',
        scope: 'process_and_configuration_only',
        dependencies_checked: false,
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        uptime_seconds: process.uptime(),
        memory_mb: {
          heap_used:
            Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
            100,
          heap_total:
            Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
            100,
        },
        configuration: {
          supabase: supabaseConfigured,
          twilio: twilioConfigured,
        },
      },
    });
  } catch (error) {
    console.error('health endpoint failed', error);
    return errorResponse('internal_error', 'Health check failed', 500);
  }
}

function methodNotAllowed() {
  return errorResponse('validation_error', 'Method not allowed', 405);
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
