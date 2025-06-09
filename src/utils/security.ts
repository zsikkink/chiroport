/**
 * Security Utilities
 * 
 * Additional security measures for API protection including
 * input sanitization, IP filtering, and suspicious activity detection.
 */

import { NextRequest } from 'next/server';

// Suspicious patterns that might indicate attacks
const SUSPICIOUS_PATTERNS = [
  /script|javascript|vbscript/i,
  /<iframe|<embed|<object/i,
  /union.*select|drop.*table|insert.*into/i,
  /<script[^>]*>.*?<\/script>/gi,
  /onload|onerror|onclick|onmouseover/i,
  /eval\(|setTimeout\(|setInterval\(/i,
  /document\.write|document\.cookie/i,
  /\.\.\/|\.\.\\|\/etc\/passwd|\/proc\//i,
];

// Common attack user agents
const SUSPICIOUS_USER_AGENTS = [
  /sqlmap|nikto|netsparker|acunetix/i,
  /havij|pangolin|nessus|openvas/i,
  /masscan|zmap|nmap/i,
  /python-requests|curl\/.*|wget\//i,
];

// Rate limiting by IP for suspicious activity
const suspiciousActivity = new Map<string, { count: number; lastSeen: number }>();

/**
 * Check if a string contains suspicious patterns
 */
export function containsSuspiciousPatterns(input: string): boolean {
  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize user input by removing/encoding potentially dangerous content
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Don't encode forward slashes as they're legitimate in dates and URLs
    .trim();
}

/**
 * Sanitize form data more carefully to preserve legitimate content
 */
export function sanitizeFormData(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // For form data, only encode the most dangerous characters
    return obj
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFormData(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Keys should still be fully sanitized
      sanitized[sanitizeInput(key)] = sanitizeFormData(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate and sanitize object inputs recursively
 */
export function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeInput(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Check if user agent looks suspicious
 */
export function isSuspiciousUserAgent(userAgent: string): boolean {
  if (!userAgent) return true; // No user agent is suspicious
  
  return SUSPICIOUS_USER_AGENTS.some(pattern => pattern.test(userAgent));
}

/**
 * Track suspicious activity by IP
 */
export function trackSuspiciousActivity(ip: string): boolean {
  const now = Date.now();
  const entry = suspiciousActivity.get(ip);
  
  if (!entry || now - entry.lastSeen > 3600000) { // Reset after 1 hour
    suspiciousActivity.set(ip, { count: 1, lastSeen: now });
    return false;
  }
  
  entry.count++;
  entry.lastSeen = now;
  
  // Block if too many suspicious requests (>10 per hour)
  return entry.count > 10;
}

/**
 * Validate request origin and referer headers
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Allow same-origin requests
  if (origin && host && origin.includes(host)) {
    return true;
  }
  
  // Allow referer from same host
  if (referer && host && referer.includes(host)) {
    return true;
  }
  
  // In development, be more lenient
  if (process.env.NODE_ENV === 'development') {
    if (origin?.includes('localhost') || referer?.includes('localhost')) {
      return true;
    }
  }
  
  // For production, be strict about origins
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_BASE_URL,
    'https://chiroport.com',
    'https://www.chiroport.com',
  ].filter((origin): origin is string => Boolean(origin));
  
  return allowedOrigins.some(allowed => 
    origin?.includes(allowed) || referer?.includes(allowed)
  );
}

/**
 * Check if request looks like a bot or automated tool
 */
export function isLikelyBot(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';
  
  // Check for bot user agents
  if (isSuspiciousUserAgent(userAgent)) {
    return true;
  }
  
  // Check for missing typical browser headers
  if (!accept.includes('text/html') && !accept.includes('application/json')) {
    return true;
  }
  
  // Check for automated tools patterns
  const botPatterns = [
    /bot|crawler|spider|scraper/i,
    /headless|phantom|selenium/i,
    /automated|test|monitor/i,
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Comprehensive security check for incoming requests
 */
export function performSecurityCheck(request: NextRequest, body?: unknown): {
  allowed: boolean;
  reason?: string;
} {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
           request.headers.get('x-real-ip') || 
           'unknown';
  
  // Check if IP is already flagged for suspicious activity
  if (trackSuspiciousActivity(ip)) {
    return { allowed: false, reason: 'Too many suspicious requests from this IP' };
  }
  
  // Check user agent
  const userAgent = request.headers.get('user-agent') || '';
  if (isSuspiciousUserAgent(userAgent)) {
    return { allowed: false, reason: 'Suspicious user agent detected' };
  }
  
  // Check origin validation for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    if (!validateOrigin(request)) {
      return { allowed: false, reason: 'Invalid origin or referer' };
    }
  }
  
  // Check body content for suspicious patterns
  if (body) {
    const bodyString = JSON.stringify(body);
    if (containsSuspiciousPatterns(bodyString)) {
      return { allowed: false, reason: 'Suspicious content patterns detected' };
    }
  }
  
  return { allowed: true };
}

/**
 * Clean up old entries from suspicious activity tracking
 */
export function cleanupSuspiciousActivity(): void {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  
  for (const [ip, entry] of suspiciousActivity.entries()) {
    if (entry.lastSeen < oneHourAgo) {
      suspiciousActivity.delete(ip);
    }
  }
}

// Clean up every hour
setInterval(cleanupSuspiciousActivity, 3600000); 