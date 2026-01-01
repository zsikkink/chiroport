'use client';

import { useState, useEffect, useCallback } from 'react';
import LocationsWrapper from '@/features/locations/LocationsWrapper';
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
  }, [screenWidth]);

  const titleStyle = getTitleSize();
  const marginSize = screenWidth > 0 ? screenWidth * 0.05 : 24;

  // Always show actual content, no loading state
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
