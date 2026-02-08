'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  title: _title = 'Chiroport',
  className = ''
}: ScrollHeaderProps) {
  void _title;
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
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
        backgroundColor: 'var(--color-header)',
        borderBottom: 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {/* Logo - Home Button */}
            <button
              onClick={handleLogoClick}
              className="
                flex items-center justify-center
                w-10 h-10
                hover:opacity-90 active:opacity-80
                transition-opacity duration-200
                focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[var(--color-header)]
                flex-shrink-0
              "
              aria-label="Go to home page"
            >
              <Image
                src="/icons/logo.svg"
                alt="Chiroport Logo"
                width={22}
                height={22}
                className="w-5 h-5"
              />
            </button>
          </div>
          <div className="w-10 h-10 flex-shrink-0" />
        </div>
      </div>
    </header>
  );
} 
