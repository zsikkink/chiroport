/**
 * Security Utilities
 * 
 * Additional security measures for API protection including
 * input sanitization, IP filtering, and suspicious activity detection.
 */

import { NextRequest } from 'next/server';

// Suspicious patterns that might indicate attacks
const SUSPICIOUS_PATTERNS = [
  // Script injection patterns - be more specific
  /<script[^>]*>.*?<\/script>/gi,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  
  // HTML injection patterns
  /<iframe[^>]*>|<embed[^>]*>|<object[^>]*>/i,
  
  // SQL injection patterns
  /union\s+select|drop\s+table|insert\s+into|delete\s+from/i,
  /(\bor\b|\band\b)\s*\d+\s*=\s*\d+/i,
  
  // Event handler injection - be more specific
  /\bon(load|error|click|mouseover|focus|blur)\s*=/i,
  
  // Function call patterns that could be malicious
  /eval\s*\(|setTimeout\s*\(|setInterval\s*\(/i,
  
  // DOM manipulation patterns
  /document\.(write|cookie|location)/i,
  
  // Path traversal patterns
  /\.\.\/|\.\.\\|\/etc\/passwd|\/proc\/|\/var\/log/i,
  
  // Additional XSS patterns
  /<\s*\/?\s*(script|iframe|embed|object|meta|link|style)\s*[^>]*>/i,
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
  if (!userAgent) {
    // Block missing user agents - these are usually automated tools
    return true;
  }
  
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
  
  // Block if too many suspicious requests (>20 per hour)
  return entry.count > 20;
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
    // Allow development requests even without origin/referer
    return true;
  }
  
  // For production, first check allowed origins
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_BASE_URL,
    'https://chiroport.com',
    'https://www.chiroport.com',
  ].filter((origin): origin is string => Boolean(origin));
  
  const isFromAllowedOrigin = allowedOrigins.some(allowed => 
    origin?.includes(allowed) || referer?.includes(allowed)
  );
  
  if (isFromAllowedOrigin) {
    return true;
  }
  
  // CUSTOMER-FRIENDLY: Allow requests without origin/referer if they have other valid indicators
  // Some privacy-focused browsers or corporate environments strip these headers
  if (!origin && !referer) {
    // If no origin/referer but request looks legitimate (has proper accept headers, etc.)
    const accept = request.headers.get('accept') || '';
    const contentType = request.headers.get('content-type') || '';
    
    if (accept.includes('application/json') || contentType.includes('application/json')) {
      // This looks like a legitimate API request
      console.log('[SECURITY] Allowing request without origin/referer - appears legitimate');
      return true;
    }
  }
  
  return false;
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
  
  // CUSTOMER-FRIENDLY: Be more lenient about accept headers
  // Some mobile browsers or embedded webviews have minimal accept headers
  if (!accept.includes('text/html') && !accept.includes('application/json') && !accept.includes('*/*')) {
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
  
  // 1. Check if IP is already flagged for suspicious activity (>20 requests per hour)
  if (trackSuspiciousActivity(ip)) {
    return { allowed: false, reason: 'Too many suspicious requests from this IP' };
  }
  
  // 2. Check user agent for automated tools, missing agents, and bot patterns
  const userAgent = request.headers.get('user-agent') || '';
  if (isSuspiciousUserAgent(userAgent)) {
    return { allowed: false, reason: 'Suspicious user agent detected' };
  }
  
  // EVERYTHING ELSE IS ALLOWED - no origin validation, no content pattern checking, etc.
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