'use client';

import { useState, useEffect, useCallback } from 'react';
import { LocationsWrapper } from '@/features/locations';
import StaticFeatureCards from './StaticFeatureCards';

/**
 * DynamicHomeContent Component
 * 
 * Client component that handles all dynamic logic for the home page:
 * - Screen width monitoring
 * - Dynamic title sizing
 * - Interactive elements
 * - Responsive layout including feature cards
 * 
 * This separates client-side logic from the static home page content
 * while ensuring proper responsive behavior between all elements.
 * Now with simplified hydration handling for better reliability.
 */
export default function DynamicHomeContent() {
  const [screenWidth, setScreenWidth] = useState(1024); // Default to desktop width

  // Handle hydration and initial mount
  useEffect(() => {
    const updateScreenWidth = () => {
      if (typeof window !== 'undefined') {
        setScreenWidth(window.innerWidth);
      }
    };

    // Set initial width
    updateScreenWidth();

    // Add resize listener
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateScreenWidth);
      
      return () => window.removeEventListener('resize', updateScreenWidth);
    }
    
    return undefined;
  }, []);

  // Calculate dynamic title size
  const getTitleSize = useCallback(() => {
    if (screenWidth === 0) {
      // Fallback for SSR
      return {
        fontSize: '64px',
        lineHeight: '1.1'
      };
    }
    
    const availableWidth = screenWidth * 0.95; // 95% of screen
    
    // Mobile: scale with available width, Desktop: larger fixed size
    if (screenWidth <= 768) {
      // Mobile: scale to fit 90% width
      const baseSize = Math.max(24, Math.min(56, availableWidth / 6.5));
      return {
        fontSize: `${baseSize}px`,
        lineHeight: '1.1'
      };
    } else {
      // Desktop: much larger fixed size
      return {
        fontSize: '100px',
        lineHeight: '1.1'
      };
    }
  }, [screenWidth]);

  const titleStyle = getTitleSize();
  const marginSize = screenWidth > 0 ? screenWidth * 0.05 : 24;

  // Always show actual content, no loading state
  return (
    <main 
      className="relative flex min-h-screen flex-col items-center overflow-x-hidden pt-24 pb-12"
      style={{
        paddingLeft: `${marginSize}px`,
        paddingRight: `${marginSize}px`
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(86,101,90,0.14),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-slate-50 via-slate-100/40 to-transparent"
      />

      {/* Hero section with dynamic title */}
      <div 
        className="w-full text-center mb-6"
        style={{
          maxWidth: '100%'
        }}
      >
        <h1 
          className="
            font-bold text-slate-900 
            whitespace-nowrap
            text-ellipsis
            w-full
          "
          style={{
            fontSize: titleStyle.fontSize,
            lineHeight: titleStyle.lineHeight,
            fontFamily: 'Libre Baskerville, serif'
          }}
        >
          Chiroport
        </h1>
        <p className="mt-3 text-lg sm:text-xl text-slate-700 font-lato">
          Airport wellness—adjustments, massage, and stretch therapy in minutes.
        </p>
        <p className="mt-2 text-sm sm:text-base text-slate-500 font-lato">
          Walk-ins welcome • Text updates • Multiple locations
        </p>
      </div>
      
      {/* Locations wrapper - this will expand and push content below */}
      <div className="w-full flex flex-col items-center gap-4 mb-10">
        <div id="locations" className="w-full flex justify-center">
          <LocationsWrapper 
            buttonText="Join the queue" 
          />
        </div>
        <div className="flex items-center gap-4 text-sm font-semibold text-emerald-900">
          <a href="#services" className="hover:text-emerald-800 transition-colors duration-200">
            View services
          </a>
          <span className="text-slate-300">•</span>
          <a href="#contact" className="hover:text-emerald-800 transition-colors duration-200">
            Contact
          </a>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {['Text updates', 'Walk-ins welcome', 'No account required'].map((label) => (
            <span
              key={label}
              className="
                rounded-full
                border border-slate-200
                bg-white/80
                px-3 py-1.5
                text-xs sm:text-sm
                font-semibold
                text-slate-600
                shadow-[0_6px_18px_-16px_rgba(15,23,42,0.35)]
              "
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Features section - now responds to menu expansion above */}
      <div className="w-full">
        <StaticFeatureCards />
      </div>
    </main>
  );
} 
