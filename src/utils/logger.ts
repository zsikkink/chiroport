/**
 * Centralized Logging Utility
 * 
 * Provides structured logging with different levels and contexts.
 * Replaces direct console.log usage throughout the application.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  function?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';

  private formatMessage(level: LogLevel, message: string, context?: LogContext, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${Object.entries(context).map(([k, v]) => `${k}:${v}`).join(', ')}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    
    return `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${message}${dataStr}`;
  }

  debug(message: string, context?: LogContext, data?: unknown): void {
    if (this.isDevelopment && this.isDebugEnabled) {
      console.log(this.formatMessage('debug', message, context, data));
    }
  }

  info(message: string, context?: LogContext, data?: unknown): void {
    if (this.isDevelopment || this.isDebugEnabled) {
      console.info(this.formatMessage('info', message, context, data));
    }
  }

  warn(message: string, context?: LogContext, data?: unknown): void {
    console.warn(this.formatMessage('warn', message, context, data));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined;
    
    console.error(this.formatMessage('error', message, context, errorData));
    
    // In production, you might want to send to an error reporting service
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true') {
      this.sendToErrorReporting(message, error, context);
    }
  }

  private sendToErrorReporting(message: string, error?: Error, context?: LogContext): void {
    // Placeholder for error reporting service integration
    // e.g., Sentry, LogRocket, etc.
    console.log('Error would be sent to error reporting service:', { message, error, context });
  }

  // API request logging
  apiRequest(method: string, url: string, data?: unknown, context?: LogContext): void {
    this.debug(`API Request: ${method} ${url}`, context, data);
  }

  apiResponse(method: string, url: string, status: number, data?: unknown, context?: LogContext): void {
    const level = status >= 400 ? 'error' : 'debug';
    if (level === 'error') {
      this.error(`API Response: ${method} ${url} - ${status}`, undefined, context);
    } else {
      this.debug(`API Response: ${method} ${url} - ${status}`, context, data);
    }
  }

  // User action logging
  userAction(action: string, context?: LogContext, data?: unknown): void {
    this.info(`User Action: ${action}`, context, data);
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    this.debug(`Performance: ${operation} took ${duration}ms`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience functions for backward compatibility
export const debugLog = (message: string, data?: unknown) => logger.debug(message, undefined, data);
export const logError = (error: Error, context?: string) => logger.error(context || 'Unknown error', error);

// Performance measurement utility
export function measurePerformance<T>(
  operation: string,
  fn: () => T | Promise<T>,
  context?: LogContext
): T | Promise<T> {
  const start = performance.now();
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        logger.performance(operation, duration, context);
      });
    } else {
      const duration = performance.now() - start;
      logger.performance(operation, duration, context);
      return result;
    }
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`${operation} failed after ${duration}ms`, error as Error, context);
    throw error;
  }
} 