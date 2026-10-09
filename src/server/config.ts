import 'server-only';

import { env } from '@/server/env';

export function debugLog(...args: unknown[]): void {
  if (env.NEXT_PUBLIC_DEBUG_MODE === 'true' || env.NODE_ENV === 'development') {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
}

export function logError(error: Error, context = 'unknown'): void {
  console.error('[ERROR]', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
}

export function logSecurityEvent(event: string, details: unknown): void {
  console.warn('[SECURITY]', {
    event,
    details,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
}
