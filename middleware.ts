import { NextRequest, NextResponse } from 'next/server';

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
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    `connect-src ${connectSrc.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : []),
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
