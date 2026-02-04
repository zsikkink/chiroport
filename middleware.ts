import { NextRequest, NextResponse } from 'next/server';

// Short-burst in-memory limiter (authoritative limits are enforced in Supabase RPCs)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

function isRateLimited(ip: string, limit: number, windowMs: number): { limited: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const key = `${ip}:${Math.floor(now / windowMs)}`;
  
  const current = requestCounts.get(key) || { count: 0, resetTime: now + windowMs };
  current.count++;
  requestCounts.set(key, current);
  
  // Cleanup old entries
  for (const [oldKey, data] of requestCounts.entries()) {
    if (data.resetTime < now) {
      requestCounts.delete(oldKey);
    }
  }
  
  return {
    limited: current.count > limit,
    remaining: Math.max(0, limit - current.count),
    reset: current.resetTime
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  
  // Apply short-burst rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    const ip = getClientIP(request);
    const limit = Number(process.env.RATE_LIMIT_API_BURST ?? 60);
    const windowMs = Number(process.env.RATE_LIMIT_API_BURST_WINDOW_MS ?? 60_000);

    const rateLimit = isRateLimited(ip, limit, windowMs);
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimit.reset).toISOString());
    
    if (rateLimit.limited) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1000)
      );
      return NextResponse.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Too many requests. Please try again later.',
            retry_after: retryAfterSeconds,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSeconds.toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.reset).toISOString(),
          },
        }
      );
    }
  }

  // Add security headers to all responses
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add Content Security Policy
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseOrigin: string | null = null;
  let supabaseWs: string | null = null;

  if (supabaseUrl) {
    try {
      supabaseOrigin = new URL(supabaseUrl).origin;
      supabaseWs = supabaseOrigin.replace('https://', 'wss://').replace('http://', 'ws://');
    } catch {
      supabaseOrigin = null;
      supabaseWs = null;
    }
  }

  const connectSrc = ["'self'"];
  if (supabaseOrigin) {
    connectSrc.push(supabaseOrigin);
  }
  if (supabaseWs) {
    connectSrc.push(supabaseWs);
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    `connect-src ${connectSrc.join(' ')}`,
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 
