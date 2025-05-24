'use client';

import { Heading, SubHeading } from './Typography';

interface LocationHeaderProps {
  locationName: string;
  concourseName: string;
  airportCode?: string;
  onBackClick?: () => void;
  className?: string;
}

/**
 * LocationHeader Component
 * 
 * Displays the location and concourse name in a centered layout.
 * Optimized for accessibility, text scaling, and preventing text cutoff.
 * Back button functionality has been removed.
 */
export default function LocationHeader({
  locationName,
  concourseName,
  airportCode,
  className = ''
}: LocationHeaderProps) {
  return (
    <div className={`w-full max-w-3xl mb-8 scale-container no-text-cutoff ${className}`}>
      <div className="w-full text-center space-y-2">
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
          <span className="inline-block">{locationName}</span>
          {airportCode && (
            <span className="inline-block ml-2">({airportCode})</span>
          )}
        </Heading>
        <SubHeading 
          className="text-[clamp(1.25rem,6vw,2.5rem)] leading-tight mobile-text-safe"
          style={{
            // Additional mobile protection for concourse names
            wordWrap: 'break-word',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            hyphens: 'auto',
            maxWidth: '100%',
            width: '100%',
          }}
        >
          {concourseName}
        </SubHeading>
      </div>
    </div>
  );
} 