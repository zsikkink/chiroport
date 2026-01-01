'use client';

import { Title } from '@/components/ui/Typography';

interface HomeHeroProps {
  title: string;
}

/**
 * HomeHero Component 
 * 
 * Displays just the large title.
 * Optimized to span maximum visual width regardless of font size settings.
 */
export default function HomeHero({ 
  title
}: HomeHeroProps) {
  // Classes for responsive layout - minimal padding to maximize title width
  const titleSectionClasses = [
    'w-full text-center',
    'pt-3 sm:pt-4 md:pt-5',
    'pb-4 sm:pb-6',
    'px-2 sm:px-1', // Minimal padding to maximize width
    'scale-container',
  ].join(' ');
  
  // Optimized title classes for maximum visual width
  const titleClasses = [
    // Updated clamp to start at 1.875rem (text-3xl) to match Locations button on mobile
    'text-[clamp(1.875rem,15vw,10rem)]', // Changed from 2.5rem to 1.875rem to match text-3xl
    'text-center',
    'mb-4 sm:mb-6',
    'leading-[1.05]', // Tighter line height for larger appearance
    'tracking-tight',
    'w-full',
    'py-1',
    'mobile-text-safe',
    'no-text-cutoff',
  ].join(' ');
  
  return (
    <div className={titleSectionClasses}>
      <Title 
        size="6xl" 
        className={titleClasses}
        style={{
          // Enhanced styles for maximum width utilization
          wordWrap: 'break-word',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          hyphens: 'auto',
          maxWidth: '100%',
          width: '100%',
          // Force maximum visual impact
          display: 'block',
          textAlign: 'center',
          margin: '0 auto',
        }}
      >
        {title}
      </Title>
    </div>
  );
} 
