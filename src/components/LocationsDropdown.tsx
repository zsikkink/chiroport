'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { LocationButton } from './Button';
import DropdownCard from './DropdownCard';
import { airportLocations, getLocationRoute } from '@/utils/locationData';

interface LocationsListProps {
  screenWidth: number;
}

export default function LocationsList({ screenWidth }: LocationsListProps) {
  const router = useRouter();

  const handleLocationClick = (airportSlug: string, concourseSlug: string) => {
    router.push(getLocationRoute(airportSlug, concourseSlug));
    // Don't close the dropdown - let user close it manually by clicking Join Queue again
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
      {airportLocations.map((airport) => {
        const hasSingleConcourse = airport.concourses.length === 1;
        const firstConcourse = airport.concourses[0];
        
        return (
          <DropdownCard
            key={airport.slug}
            title={`${airport.name} Airport`}
            initiallyOpen={false}
            className="mb-4"
            {...(hasSingleConcourse && firstConcourse ? {
              onClick: () => handleLocationClick(airport.slug, firstConcourse.slug)
            } : {})}
            screenWidth={screenWidth}
          >
            <div className="space-y-2">
              {airport.concourses.map((concourse) => (
                <LocationButton 
                  key={concourse.slug}
                  fullWidth
                  onClick={() => handleLocationClick(airport.slug, concourse.slug)}
                  className="
                    w-full overflow-hidden
                    bg-primary
                    hover:bg-[#475549] hover:bg-opacity-90
                    transition-colors duration-200
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