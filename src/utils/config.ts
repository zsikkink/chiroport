/**
 * Application Configuration
 * 
 * Centralized configuration for the application including
 * security settings, API endpoints, and monitoring.
 */

// Environment variables with defaults
export const config = {
  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    waitwhile: {
      url: process.env.WAITWHILE_API_URL || 'https://api.waitwhile.com/v2',
      apiKey: process.env.WAITWHILE_API_KEY,
      webhookSecret: process.env.WAITWHILE_WEBHOOK_SECRET,
    }
  },

  // Security Configuration
  security: {
    csrf: {
      secret: process.env.CSRF_SECRET,
      enabled: !!process.env.CSRF_SECRET,
    },
    rateLimit: {
      api: parseInt(process.env.RATE_LIMIT_API || '30', 10),
      submit: parseInt(process.env.RATE_LIMIT_SUBMIT || '5', 10),
      enabled: true,
    },
    headers: {
      csp: process.env.CONTENT_SECURITY_POLICY || "default-src 'self'",
      hsts: process.env.NODE_ENV === 'production',
    }
  },

  // Feature Flags
  features: {
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    errorReporting: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
    debugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
  },

  // Monitoring
  monitoring: {
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
      secret: process.env.HEALTH_CHECK_SECRET,
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      enabled: true,
    }
  },

  // Performance
  performance: {
    imageQuality: parseInt(process.env.NEXT_PUBLIC_IMAGE_QUALITY || '85', 10),
    cacheTimeout: parseInt(process.env.NEXT_PUBLIC_CACHE_TIMEOUT || '300000', 10),
  }
};

// Validation: Check required environment variables
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required in production
  if (config.isProduction) {
    if (!config.security.csrf.secret) {
      errors.push('CSRF_SECRET is required in production');
    }
    if (!config.api.waitwhile.apiKey) {
      errors.push('WAITWHILE_API_KEY is required');
    }
    if (!config.monitoring.healthCheck.secret) {
      errors.push('HEALTH_CHECK_SECRET is recommended in production');
    }
  }

  // Always required
  if (!config.api.waitwhile.apiKey) {
    errors.push('WAITWHILE_API_KEY is required for API functionality');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Security headers configuration
export function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  // Add HSTS in production
  if (config.security.headers.hsts) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://api.waitwhile.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.waitwhile.com https://vitals.vercel-insights.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // Add upgrade-insecure-requests in production
  if (config.isProduction) {
    csp.push("upgrade-insecure-requests");
  }

  headers['Content-Security-Policy'] = csp.join('; ');

  return headers;
}

// Logging utilities
export function debugLog(...args: unknown[]): void {
  if (config.features.debugMode || config.isDevelopment) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
}

export function logError(error: Error, context?: string): void {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context: context || 'Unknown',
    timestamp: new Date().toISOString(),
    environment: config.isDevelopment ? 'development' : 'production'
  };

  // Always log errors
  console.error('[ERROR]', errorInfo);

  // In production, you might want to send to error reporting service
  if (config.features.errorReporting && config.isProduction) {
    // TODO: Integrate with error reporting service (Sentry, etc.)
    // errorReportingService.captureException(error, { extra: errorInfo });
  }
}

export function logSecurityEvent(event: string, details: unknown): void {
  const securityLog = {
    event,
    details,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  };

  console.warn('[SECURITY]', securityLog);

  // In production, you might want to send to security monitoring
  if (config.isProduction) {
    // TODO: Integrate with security monitoring service
    // securityMonitoring.logEvent(securityLog);
  }
}

// Rate limiting configuration
export function getRateLimitConfig(endpoint: string): { limit: number; windowMs: number } {
  const isSubmitEndpoint = endpoint.includes('/submit');
  
  return {
    limit: isSubmitEndpoint ? config.security.rateLimit.submit : config.security.rateLimit.api,
    windowMs: isSubmitEndpoint ? 5 * 60 * 1000 : 60 * 1000 // 5 min for submit, 1 min for others
  };
}

// Export configuration validation on module load
const validation = validateConfig();
if (!validation.valid && config.isProduction) {
  console.error('Configuration validation failed:', validation.errors);
  // In production, you might want to exit the process
  // process.exit(1);
} else if (!validation.valid) {
  console.warn('Configuration warnings:', validation.errors);
} 