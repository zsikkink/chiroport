'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { LocationButton } from './Button';
import DropdownCard from './DropdownCard';
import { airportLocations, getLocationRoute } from '@/utils/locationData';

interface LocationsListProps {
  onClose: () => void;
  screenWidth: number;
}

export default function LocationsList({ onClose, screenWidth }: LocationsListProps) {
  const router = useRouter();

  const handleLocationClick = (airportSlug: string, concourseSlug: string) => {
    router.push(getLocationRoute(airportSlug, concourseSlug));
    onClose();
  };

  // Calculate dynamic text size for dropdown content
  const getDropdownTextSize = useCallback(() => {
    const availableWidth = screenWidth * 0.9; // 90% of screen
    const baseSize = Math.max(14, Math.min(24, availableWidth / 20));
    
    return {
      titleSize: `${baseSize * 1.2}px`,
      buttonSize: `${baseSize}px`,
      lineHeight: '1.3'
    };
  }, [screenWidth]);

  const textSizes = getDropdownTextSize();

  return (
    <div className="w-full overflow-hidden">
      {airportLocations.map((airport, index) => {
        const hasSingleConcourse = airport.concourses.length === 1;
        
        return (
          <DropdownCard 
            key={airport.code} 
            title={`${airport.name} (${airport.code})`}
            initiallyOpen={index === 0 && !hasSingleConcourse}
            className="mb-4 w-full"
            onClick={hasSingleConcourse ? () => handleLocationClick(airport.slug, airport.concourses[0].slug) : undefined}
            screenWidth={screenWidth}
          >
            <div className="space-y-3 w-full">
              {airport.concourses.map((concourse) => (
                <LocationButton 
                  key={concourse.slug}
                  fullWidth
                  onClick={() => handleLocationClick(airport.slug, concourse.slug)}
                  className="
                    w-full overflow-hidden
                    bg-primary
                    hover:bg-white hover:bg-opacity-10
                    transition-all duration-200
                    rounded-md
                    border-0
                  "
                  style={{
                    fontSize: textSizes.buttonSize,
                    lineHeight: textSizes.lineHeight,
                    minHeight: `${Math.max(36, parseInt(textSizes.buttonSize) * 1.8)}px`
                  }}
                >
                  <span className="
                    font-medium 
                    overflow-hidden
                    whitespace-nowrap
                    text-ellipsis
                    w-full text-center
                  ">
                    {concourse.displayName}
                  </span>
                </LocationButton>
              ))}
            </div>
          </DropdownCard>
        );
      })}
    </div>
  );
} 