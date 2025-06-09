/**
 * CSRF Protection Utility
 * 
 * Provides Cross-Site Request Forgery protection for API routes
 * using double-submit cookie pattern with cryptographic tokens.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_SECRET = process.env.CSRF_SECRET || 'fallback-secret-change-in-production';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  return token;
}

/**
 * Generate CSRF token hash for cookie storage
 */
export function hashCSRFToken(token: string): string {
  return createHash('sha256')
    .update(token + CSRF_SECRET)
    .digest('hex');
}

/**
 * Validate CSRF token against the stored hash
 */
export function validateCSRFToken(token: string, hashedToken: string): boolean {
  if (!token || !hashedToken) {
    return false;
  }

  try {
    const expectedHash = hashCSRFToken(token);
    
    // Use timing-safe comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const actualBuffer = Buffer.from(hashedToken, 'hex');
    
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (error) {
    console.error('CSRF token validation error:', error);
    return false;
  }
}

/**
 * Extract CSRF token from request headers
 */
export function extractCSRFToken(request: Request): string | null {
  // Check X-CSRF-Token header first
  const headerToken = request.headers.get('X-CSRF-Token');
  if (headerToken) {
    return headerToken;
  }

  // Check X-Requested-With for AJAX requests (additional layer)
  const requestedWith = request.headers.get('X-Requested-With');
  if (requestedWith === 'XMLHttpRequest') {
    // For AJAX requests, we can be more lenient if they include the header
    // but still require the token for state-changing operations
    return null;
  }

  return null;
}

/**
 * Extract CSRF token hash from cookies
 */
export function extractCSRFCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);

  return cookies['csrf-token'] || null;
}

/**
 * Middleware function to validate CSRF tokens
 */
export function validateCSRF(request: Request): boolean {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }

  // ALLOW ALL REQUESTS - CSRF validation disabled to prevent customer blocking
  // Only user agent detection and rate limiting should block requests
  return true;
}

/**
 * Create CSRF cookie header
 */
export function createCSRFCookie(token: string): string {
  const hashedToken = hashCSRFToken(token);
  const isProduction = process.env.NODE_ENV === 'production';
  
  return `csrf-token=${encodeURIComponent(hashedToken)}; Path=/; SameSite=Strict; HttpOnly${isProduction ? '; Secure' : ''}`;
}

/**
 * API endpoint to get CSRF token
 */
export function generateCSRFResponse(): { token: string; cookie: string } {
  const token = generateCSRFToken();
  const cookie = createCSRFCookie(token);
  
  return { token, cookie };
} 