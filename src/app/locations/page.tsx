'use client';

import ResponsiveLayout from '@/components/ResponsiveLayout';
import { useRouter } from 'next/navigation';
import { LocationButton } from '@/components/Button';
import DropdownCard from '@/components/DropdownCard';
import ScrollHeader from '@/components/ScrollHeader';
import { airportLocations, getLocationRoute } from '@/utils/locationData';

export default function LocationsPage() {
  const router = useRouter();

  const handleConcourseClick = (airportSlug: string, concourseSlug: string) => {
    router.push(getLocationRoute(airportSlug, concourseSlug));
  };

  return (
    <>
      <ScrollHeader title="Locations" />
      
      <ResponsiveLayout>
        <main className="flex min-h-screen flex-col items-center pt-20 py-6 sm:py-8 md:py-10 px-4 overflow-x-hidden bg-primary">
          <div className="w-full max-w-3xl">
            {airportLocations.map((airport, index) => {
              const hasSingleConcourse = airport.concourses.length === 1;
              
              return (
                <DropdownCard 
                  key={airport.code} 
                  title={`${airport.name} (${airport.code})`}
                  initiallyOpen={index === 0 && !hasSingleConcourse}
                  className={hasSingleConcourse ? 'cursor-pointer' : ''}
                  onClick={hasSingleConcourse ? () => handleConcourseClick(airport.slug, airport.concourses[0].slug) : undefined}
                >
                  <div className="space-y-4">
                    {airport.concourses.map((concourse) => (
                      <LocationButton 
                        key={concourse.slug}
                        fullWidth
                        onClick={() => handleConcourseClick(airport.slug, concourse.slug)}
                      >
                        <span className="text-xl sm:text-2xl font-medium">{concourse.displayName}</span>
                      </LocationButton>
                    ))}
                  </div>
                </DropdownCard>
              );
            })}
          </div>
        </main>
      </ResponsiveLayout>
    </>
  );
} 