'use client';

import { Heading } from './Typography';

/**
 * LocationHeader Component
 * 
 * Displays the location name in a centered layout.
 * Optimized for accessibility, text scaling, and preventing text cutoff.
 * Back button functionality has been removed.
 */
export default function LocationHeader({ 
  airportCode 
}: { 
  airportCode: string;
}) {
  return (
    <div className={`w-full max-w-3xl mb-8 scale-container no-text-cutoff`}>
      <div className="w-full text-center">
        <Heading 
          className="text-[clamp(1.5rem,8vw,3rem)] mb-2 leading-tight mobile-text-safe"
          style={{
            // Additional mobile protection for location names
            wordWrap: 'break-word',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            hyphens: 'auto',
            maxWidth: '100%',
            width: '100%',
          }}
        >
          {airportCode && (
            <span className="inline-block">{airportCode}</span>
          )}
        </Heading>
      </div>
    </div>
  );
} 