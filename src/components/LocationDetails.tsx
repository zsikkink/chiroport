'use client';

import ResponsiveCard from './ResponsiveCard';
import { Heading, BodyText } from './Typography';
import { LocationInfo } from '@/utils/locationData';

interface LocationDetailsProps {
  locationInfo: LocationInfo;
  className?: string;
}

/**
 * LocationDetails Component
 * 
 * Displays detailed information about a location including
 * its custom description and operating hours.
 */
export default function LocationDetails({ locationInfo, className = '' }: LocationDetailsProps) {
  return (
    <ResponsiveCard className={`mb-4 ${className}`}>
      <div className="space-y-6">
        <div className="flex flex-col mt-2.5">
          <Heading size="2xl" className="font-bold mb-2">Location</Heading>
          <BodyText size="2xl" className="font-medium text-white">{locationInfo.customLocation}</BodyText>
        </div>
        
        <div>
          <BodyText size="2xl" className="font-medium text-white">
            <span className="font-bold">Hours:</span> {locationInfo.customHours}
          </BodyText>
        </div>
      </div>
    </ResponsiveCard>
  );
} 