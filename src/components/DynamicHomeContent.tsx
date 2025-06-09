'use client';

import { useState, useEffect, useCallback } from 'react';
import LocationsWrapper from './LocationsWrapper';
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
 * Now includes proper hydration handling to prevent SSR errors.
 */
export default function DynamicHomeContent() {
  const [mounted, setMounted] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);

  // Handle hydration and initial mount
  useEffect(() => {
    setMounted(true);
    
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
    
    // Return undefined for the case where window is not available
    return undefined;
  }, []);

  // Calculate dynamic title size
  const getTitleSize = useCallback(() => {
    if (!mounted || screenWidth === 0) {
      // Default fallback for SSR/before mount
      return {
        fontSize: '64px',
        lineHeight: '1.1'
      };
    }
    
    const availableWidth = screenWidth * 0.95; // 90% of screen
    
    // Mobile: scale with available width, Desktop: larger fixed size
    if (screenWidth <= 768) {
      // Mobile: scale to fit 90% width
      const baseSize = Math.max(24, Math.min(64, availableWidth / 6));
      return {
        fontSize: `${baseSize}px`,
        lineHeight: '1.1'
      };
    } else {
      // Desktop: much larger fixed size
      return {
        fontSize: '120px', // Increased from 80px
        lineHeight: '1.1'
      };
    }
  }, [mounted, screenWidth]);

  const titleStyle = getTitleSize();
  const marginSize = mounted && screenWidth > 0 ? screenWidth * 0.05 : 24; // 5% margin or fallback

  // Show loading state during hydration
  if (!mounted) {
    return (
      <main className="flex min-h-screen flex-col items-center overflow-x-hidden pt-20 py-6 px-6">
        {/* Hero section with static fallback */}
        <div className="w-full text-center mb-10">
          <h1 
            className="
              font-bold text-white 
              whitespace-nowrap
              text-ellipsis
              w-full
            "
            style={{
              fontSize: '64px',
              lineHeight: '1.1',
              fontFamily: 'Libre Baskerville, serif'
            }}
          >
            Chiroport
          </h1>
        </div>
        
        {/* Static content during loading */}
        <div className="w-full flex justify-center mb-8">
          <div className="animate-pulse bg-gray-200 rounded-lg h-12 w-48"></div>
        </div>

        <div className="w-full">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-200 rounded-lg h-48"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main 
      className="flex min-h-screen flex-col items-center overflow-x-hidden pt-20 py-6"
      style={{
        paddingLeft: `${marginSize}px`,
        paddingRight: `${marginSize}px`
      }}
    >
      {/* Hero section with dynamic title */}
      <div 
        className="w-full text-center mb-10"
        style={{
          maxWidth: '100%'
        }}
      >
        <h1 
          className="
            font-bold text-white 
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
      </div>
      
      {/* Locations wrapper - this will expand and push content below */}
      <div className="w-full flex justify-center mb-8">
        <LocationsWrapper 
          buttonText="Join Queue" 
        />
      </div>

      {/* Features section - now responds to menu expansion above */}
      <div className="w-full">
        <StaticFeatureCards />
      </div>
    </main>
  );
} 