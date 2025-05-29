'use client';

import { useState, useEffect, useCallback } from 'react';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import HomeHero from '@/components/HomeHero';
import FeatureCards from '@/components/FeatureCards';
import ScrollHeader from '@/components/ScrollHeader';
import LocationsWrapper from '@/components/LocationsWrapper';

/**
 * Home Page
 * 
 * The main landing page for the Chiroport application.
 * Implements dynamic width-based layout:
 * - 5% margins on each side (90% total screen width)
 * - Title spans full available width with max size on large screens
 * - Locations button uses 80% closed, 90% open
 * - Text scales dynamically to fit without wrapping
 */
export default function Home() {
  const [screenWidth, setScreenWidth] = useState(0);

  // Monitor screen width constantly
  useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    // Set initial width
    updateScreenWidth();

    // Add resize listener
    window.addEventListener('resize', updateScreenWidth);
    
    return () => window.removeEventListener('resize', updateScreenWidth);
  }, []);

  // Calculate dynamic title size
  const getTitleSize = useCallback(() => {
    const availableWidth = screenWidth * 0.9; // 90% of screen
    
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
  const marginSize = screenWidth * 0.05; // 5% margin

  return (
    <>
      {/* Scroll-aware header */}
      <ScrollHeader title="" />
      
      <ResponsiveLayout>
        <main 
          className="flex min-h-screen flex-col items-center overflow-x-hidden pt-20 py-6"
          style={{
            paddingLeft: `${marginSize}px`,
            paddingRight: `${marginSize}px`
          }}
        >
          {/* Hero section with dynamic title */}
          <div 
            className="w-full text-center mb-8"
            style={{
              maxWidth: '100%'
            }}
          >
            <h1 
              className="
                font-bold text-white 
                overflow-hidden
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
          
          {/* Locations wrapper - positioned absolutely to handle its own margins */}
          <div className="w-full flex justify-center mb-8">
            <LocationsWrapper 
              buttonText="Join Queue" 
            />
          </div>
          
          {/* Features section */}
          <div className="w-full">
            <FeatureCards />
          </div>
        </main>
      </ResponsiveLayout>
    </>
  );
}