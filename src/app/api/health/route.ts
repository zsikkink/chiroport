/**
 * Health Check API Route
 * 
 * GET /api/health
 * Provides system health status and security metrics for monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config, env } from '@/server';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/server/rateLimit';

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
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const healthCheckSecret = env.HEALTH_CHECK_SECRET;
    const providedSecret = request.headers.get('x-health-secret');
    const isProduction = env.NODE_ENV === 'production';

    // Basic authentication for health endpoint
    if (isProduction && !healthCheckSecret) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (healthCheckSecret && providedSecret !== healthCheckSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check environment configuration
    const envChecks = {
      supabaseUrl: !!config.api.supabase.url,
      supabaseAnonKey: !!config.api.supabase.anonKey,
      twilioAccountSid: !!config.messaging.twilio.accountSid,
      rateLimit: {
        api: config.security.rateLimit.api,
        submit: config.security.rateLimit.submit
      }
    };

    // System health metrics
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
      },
      security: {
        rateLimitingEnabled: true,
        apiProtected: envChecks.supabaseUrl && envChecks.supabaseAnonKey,
        rateLimit: envChecks.rateLimit
      },
      services: {
        supabase: {
          configured: envChecks.supabaseUrl && envChecks.supabaseAnonKey
        },
        twilio: {
          configured: envChecks.twilioAccountSid
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: health
    });

  } catch {
    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
} 
