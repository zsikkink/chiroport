import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Development optimizations to prevent cache corruption
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 25 * 1000,
      // number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 2,
    },
  }),
  
  // Security headers are now handled by middleware.ts for better control
  
  // Webpack configuration - disable problematic caching in development
  webpack: (config, { dev, isServer }) => {
    // DISABLE filesystem caching in development to prevent corruption
    if (dev) {
      config.cache = false; // Completely disable caching in development
      
      // Optimize for development stability over speed
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'async', // More conservative chunking
          minSize: 20000,
          maxSize: 200000, // Smaller chunks to prevent memory issues
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all',
              maxSize: 200000,
            },
          },
        },
      };
    }
    
    // Production optimizations only
    if (!dev && !isServer) {
      config.optimization.splitChunks.chunks = 'all';
    }
    
    return config;
  },
  
  // Experimental features - only stable ones
  experimental: {
    optimizePackageImports: ['@heroicons/react'],
  },
};

export default nextConfig;
