'use client';

import { useRouter } from 'next/navigation';
import { LocationButton } from './Button';
import DropdownCard from './DropdownCard';
import { airportLocations, getLocationRoute } from '@/utils/locationData';

interface LocationsListProps {
  isExpanded: boolean;
  onClose: () => void;
}

export default function LocationsList({ isExpanded, onClose }: LocationsListProps) {
  const router = useRouter();

  const handleLocationClick = (airportSlug: string, concourseSlug: string) => {
    router.push(getLocationRoute(airportSlug, concourseSlug));
    onClose();
  };

  return (
    <div className="w-full">
      {airportLocations.map((airport, index) => {
        const hasSingleConcourse = airport.concourses.length === 1;
        
        return (
          <DropdownCard 
            key={airport.code} 
            title={`${airport.name} (${airport.code})`}
            initiallyOpen={index === 0 && !hasSingleConcourse}
            className={`mb-4 ${hasSingleConcourse ? 'cursor-pointer' : ''}`}
            onClick={hasSingleConcourse ? () => handleLocationClick(airport.slug, airport.concourses[0].slug) : undefined}
          >
            <div className="space-y-3">
              {airport.concourses.map((concourse) => (
                <LocationButton 
                  key={concourse.slug}
                  fullWidth
                  onClick={() => handleLocationClick(airport.slug, concourse.slug)}
                >
                  <span className="text-lg sm:text-xl font-medium">{concourse.displayName}</span>
                </LocationButton>
              ))}
            </div>
          </DropdownCard>
        );
      })}
    </div>
  );
} 