/**
 * Rate Limiting Utility
 * 
 * Provides rate limiting functionality for API routes
 * to prevent abuse and ensure fair usage.
 */

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Number of requests allowed per interval
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

class RateLimiter {
  private cache = new Map<string, { count: number; resetTime: number }>();
  private config: RateLimitConfig;
  private lastCleanup = 0;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();

    if (now - this.lastCleanup > 60_000) {
      this.cleanup(now);
    }
    
    // Get or create entry for this identifier
    let entry = this.cache.get(identifier);
    
    if (!entry || entry.resetTime <= now) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime: now + this.config.interval,
      };
      this.cache.set(identifier, entry);
      
      return {
        success: true,
        limit: this.config.uniqueTokenPerInterval,
        remaining: this.config.uniqueTokenPerInterval - 1,
        reset: entry.resetTime,
      };
    }
    
    // Check if limit exceeded
    if (entry.count >= this.config.uniqueTokenPerInterval) {
      return {
        success: false,
        limit: this.config.uniqueTokenPerInterval,
        remaining: 0,
        reset: entry.resetTime,
      };
    }
    
    // Increment count
    entry.count++;
    
    return {
      success: true,
      limit: this.config.uniqueTokenPerInterval,
      remaining: this.config.uniqueTokenPerInterval - entry.count,
      reset: entry.resetTime,
    };
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.resetTime <= now) {
        this.cache.delete(key);
      }
    }
    this.lastCleanup = now;
  }

  getStats(): { activeEntries: number; totalRequests: number } {
    let totalRequests = 0;
    for (const entry of this.cache.values()) {
      totalRequests += entry.count;
    }
    
    return {
      activeEntries: this.cache.size,
      totalRequests,
    };
  }
}

// Pre-configured rate limiters for different use cases
export const apiRateLimiter = new RateLimiter({
  interval: 60000, // 1 minute
  uniqueTokenPerInterval: 30, // 30 requests per minute
});

export const submitRateLimiter = new RateLimiter({
  interval: 300000, // 5 minutes
  uniqueTokenPerInterval: 5, // 5 form submissions per 5 minutes
});

// Utility function to get client IP address
export function getClientIP(request: Request): string {
  // Check various headers for IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cloudflareIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cloudflareIP) {
    return cloudflareIP;
  }
  
  return 'unknown';
}

// Middleware function for Next.js API routes
export async function withRateLimit(
  request: Request,
  rateLimiter: RateLimiter = apiRateLimiter
): Promise<{ allowed: boolean; headers: Record<string, string> }> {
  const ip = getClientIP(request);
  const result = await rateLimiter.limit(ip);
  
  const headers = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  };
  
  return {
    allowed: result.success,
    headers,
  };
} 
