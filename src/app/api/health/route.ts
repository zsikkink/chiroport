/**
 * Health Check API Route
 * 
 * GET /api/health
 * Provides system health status and security metrics for monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const healthCheckSecret = process.env.HEALTH_CHECK_SECRET;
    const providedSecret = request.headers.get('x-health-secret') || 
                          request.nextUrl.searchParams.get('secret');

    // Basic authentication for health endpoint
    if (healthCheckSecret && providedSecret !== healthCheckSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check environment configuration
    const envChecks = {
      csrfSecret: !!process.env.CSRF_SECRET,
      waitwhileApiKey: !!process.env.WAITWHILE_API_KEY,
      rateLimit: {
        api: process.env.RATE_LIMIT_API || '30',
        submit: process.env.RATE_LIMIT_SUBMIT || '5'
      }
    };

    // System health metrics
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
      },
      security: {
        csrfEnabled: envChecks.csrfSecret,
        rateLimitingEnabled: true,
        apiProtected: !!process.env.WAITWHILE_API_KEY,
        rateLimit: envChecks.rateLimit
      },
      services: {
        waitwhile: {
          configured: !!process.env.WAITWHILE_API_KEY,
          url: process.env.WAITWHILE_API_URL || 'https://api.waitwhile.com/v2'
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: health
    });

  } catch (error) {
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