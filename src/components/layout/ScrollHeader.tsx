'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Title } from '@/components/ui';
import Image from 'next/image';

interface ScrollHeaderProps {
  title?: string;
  className?: string;
}

/**
 * ScrollHeader Component
 * 
 * A fixed header that stays visible at all times.
 * Features a logo that acts as a home button and customizable title.
 * Uses backdrop blur for a polished user experience when scrolled.
 * Dynamically sizes text to prevent wrapping.
 */
export default function ScrollHeader({
  title = 'Chiroport',
  className = ''
}: ScrollHeaderProps) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);

  // Monitor screen width for dynamic text sizing
  useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    updateScreenWidth();
    window.addEventListener('resize', updateScreenWidth);
    
    return () => window.removeEventListener('resize', updateScreenWidth);
  }, []);

  // Calculate dynamic text size based on available width
  const getTextSize = useCallback(() => {
    if (screenWidth === 0) return { fontSize: '24px', lineHeight: '1.2' };
    
    // Calculate available width for text
    const logoSpace = 48; // 12 * 4 (w-12)
    const padding = screenWidth > 640 ? 48 : 32; // px-4 vs px-6
    const spacerWidth = 48; // Right spacer
    const availableWidth = screenWidth - logoSpace - padding - spacerWidth - 32; // Extra margin
    
    // Calculate optimal font size based on text length and available width
    const textLength = title.length;
    const charWidthRatio = 0.6; // Approximate character width ratio
    
    // Start with reasonable base sizes
    let fontSize = screenWidth > 640 ? 36 : 24; // Base: text-4xl vs text-2xl
    
    // Calculate what size would fit
    const estimatedTextWidth = textLength * fontSize * charWidthRatio;
    
    if (estimatedTextWidth > availableWidth) {
      // Scale down to fit
      fontSize = Math.max(16, availableWidth / (textLength * charWidthRatio));
    }
    
    // Ensure reasonable bounds
    const minSize = 16;
    const maxSize = screenWidth > 640 ? 36 : 28;
    fontSize = Math.max(minSize, Math.min(maxSize, fontSize));
    
    return {
      fontSize: `${fontSize}px`,
      lineHeight: '1.2'
    };
  }, [screenWidth, title]);

  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      
      // Track if we've scrolled from the top for visual effects
      setIsScrolled(currentScrollY > 10);
    };

    // Add scroll event listener with throttling for performance
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          controlHeader();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Check initial scroll position
    controlHeader();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogoClick = () => {
    router.push('/');
  };

  const textStyle = getTextSize();

  return (
    <header 
      className={`
        header-stack
        bg-[var(--color-primary)]
        ${isScrolled ? 'header-shadow header-blur border-b border-white/20' : 'border-b border-white/10'}
        transition-all duration-300 ease-in-out
        ${className}
      `}
      style={{
        backgroundColor: isScrolled 
          ? 'rgba(86, 101, 90, 0.95)' // More opaque when scrolled
          : 'rgba(86, 101, 90, 0.98)', // Slightly less opaque at top
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Home Button */}
          <button
            onClick={handleLogoClick}
            className="
              flex items-center justify-center
              w-12 h-12
              hover:opacity-80 active:opacity-70
              transition-opacity duration-200
              focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[var(--color-primary)]
              flex-shrink-0
            "
            aria-label="Go to home page"
          >
            <Image
              src="/icons/logo.svg"
              alt="Chiroport Logo"
              width={24}
              height={24}
              className="w-6 h-6"
            />
          </button>

          {/* Title - Centered with Dynamic Sizing */}
          <div className="flex-1 text-center px-4 overflow-hidden">
            <Title 
              font="lato"
              className="font-bold text-white whitespace-nowrap overflow-hidden"
              style={{
                fontSize: textStyle.fontSize,
                lineHeight: textStyle.lineHeight,
                maxWidth: '100%',
              }}
            >
              {title}
            </Title>
          </div>

          {/* Right spacer to balance the logo */}
          <div className="w-12 h-12 flex-shrink-0" />
        </div>
      </div>
    </header>
  );
} 
