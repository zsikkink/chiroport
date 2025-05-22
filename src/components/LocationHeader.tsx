'use client';

import { Heading, SubHeading } from './Typography';
import { BackButton } from './Button';

interface LocationHeaderProps {
  locationName: string;
  concourseName: string;
  airportCode?: string;
  onBackClick: () => void;
  className?: string;
}

/**
 * LocationHeader Component
 * 
 * Displays the location and concourse name along with a back button.
 */
export default function LocationHeader({
  locationName,
  concourseName,
  airportCode,
  onBackClick,
  className = ''
}: LocationHeaderProps) {
  return (
    <div className={`w-full max-w-3xl relative mb-8 ${className}`}>
      <div className="w-full flex flex-col mb-2">
        <BackButton 
          onClick={onBackClick}
          className="self-start mb-4 sm:mb-0 sm:absolute sm:left-0 sm:top-1/2 sm:-translate-y-1/2"
        >
          Back
        </BackButton>
        
        <div className="w-full text-center sm:mt-0">
          <Heading className="text-3xl sm:text-4xl md:text-5xl mb-2">
            {locationName} {airportCode && `(${airportCode})`}
          </Heading>
          <SubHeading className="text-2xl sm:text-3xl md:text-4xl">
            {concourseName}
          </SubHeading>
        </div>
      </div>
    </div>
  );
} 