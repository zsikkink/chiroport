/**
 * Application Configuration
 * 
 * Central configuration management for environment variables,
 * feature flags, and application settings.
 */

// Environment detection
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

// API Configuration
export const config = {
  // Application Settings
  app: {
    name: 'Chiroport',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  },

  // Waitwhile API Configuration
  waitwhile: {
    apiKey: process.env.WAITWHILE_API_KEY || '',
    apiUrl: process.env.WAITWHILE_API_URL || 'https://api.waitwhile.com/v2',
    webhookSecret: process.env.WAITWHILE_WEBHOOK_SECRET || '',
    scriptUrl: process.env.NEXT_PUBLIC_WAITWHILE_SCRIPT_URL || 'https://cdn.jsdelivr.net/npm/@waitwhile/waitwhile-embed/dist/waitwhile-embed.min.js',
  },

  // Feature Flags
  features: {
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    enableErrorReporting: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
    enableDebugMode: isDevelopment || process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
  },

  // Image Configuration
  images: {
    domains: ['localhost'],
    formats: ['webp', 'jpeg'],
    quality: parseInt(process.env.NEXT_PUBLIC_IMAGE_QUALITY || '85'),
  },

  // Performance Settings
  performance: {
    enablePreload: process.env.NEXT_PUBLIC_ENABLE_PRELOAD !== 'false',
    cacheTimeout: parseInt(process.env.NEXT_PUBLIC_CACHE_TIMEOUT || '300000'), // 5 minutes
  },
} as const;

// Validation function to ensure required environment variables are set
export function validateConfig() {
  const requiredEnvVars: string[] = [];
  
  // In production, require Waitwhile API key
  if (isProduction) {
    requiredEnvVars.push('WAITWHILE_API_KEY');
  }

  const missing = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

// Helper function to validate Waitwhile configuration
export function validateWaitwhileConfig() {
  if (!config.waitwhile.apiKey) {
    throw new Error('Waitwhile API key is required');
  }
  if (!config.waitwhile.apiUrl) {
    throw new Error('Waitwhile API URL is required');
  }
}

// Helper functions
export function isFeatureEnabled(feature: keyof typeof config.features): boolean {
  return config.features[feature];
}

export function getImageQuality(): number {
  return config.images.quality;
}

// Debug logging helper
export function debugLog(message: string, data?: any) {
  if (config.features.enableDebugMode) {
    console.log(`[Chiroport Debug] ${message}`, data || '');
  }
}

// Error logging helper
export function logError(error: Error, context?: string) {
  if (config.features.enableErrorReporting) {
    console.error(`[Chiroport Error] ${context || 'Unknown context'}:`, error);
    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { tags: { context } });
  }
} 