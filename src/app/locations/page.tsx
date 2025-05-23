'use client';

import ResponsiveLayout from '@/components/ResponsiveLayout';
import { useRouter } from 'next/navigation';
import { Heading } from '@/components/Typography';
import { BackButton, LocationButton } from '@/components/Button';
import DropdownCard from '@/components/DropdownCard';

// Airport data structure for organizing concourses by airport
interface AirportLocation {
  name: string;
  code: string;
  concourses: {
    name: string;
    route: string;
    displayName: string;
  }[];
}

// All airport locations and their concourses
const airportLocations: AirportLocation[] = [
  {
    name: 'Atlanta',
    code: 'ATL',
    concourses: [
      { name: 'concourse-a', route: 'atlanta/concourse-a', displayName: 'Concourse A' }
    ]
  },
  {
    name: 'Dallas',
    code: 'DFW',
    concourses: [
      { name: 'concourse-a', route: 'dallas/concourse-a', displayName: 'Concourse A' }
    ]
  },
  {
    name: 'Houston',
    code: 'HOU',
    concourses: [
      { name: 'concourse-a', route: 'houston/concourse-a', displayName: 'West Concourse' }
    ]
  },
  {
    name: 'Las Vegas',
    code: 'LAS',
    concourses: [
      { name: 'concourse-b', route: 'las-vegas/concourse-b', displayName: 'Concourse B' },
      { name: 'concourse-c', route: 'las-vegas/concourse-c', displayName: 'Concourse C' }
    ]
  },
  {
    name: 'Minneapolis',
    code: 'MSP',
    concourses: [
      { name: 'concourse-c', route: 'minneapolis/concourse-c', displayName: 'Concourse C' },
      { name: 'concourse-f', route: 'minneapolis/concourse-f', displayName: 'Concourse F' },
      { name: 'concourse-g', route: 'minneapolis/concourse-g', displayName: 'Concourse G' }
    ]
  }
];

export default function LocationsPage() {
  const router = useRouter();

  // Handle concourse selection with location and concourse parameters
  const handleConcourseClick = (route: string) => {
    router.push(`/locations/${route}`);
  };

  // Handle back to home navigation
  const handleBackClick = () => {
    router.push('/');
  };

  return (
    <ResponsiveLayout>
      <main className="flex min-h-screen flex-col items-center py-6 sm:py-8 md:py-10 px-4 overflow-x-hidden bg-primary">
        <div className="w-full max-w-3xl relative mb-8">
          <div className="w-full text-center mb-2">
            <Heading className="text-4xl sm:text-5xl md:text-6xl font-semibold text-white">
              Locations
            </Heading>
          </div>
          <BackButton 
            onClick={handleBackClick}
            className="absolute left-0 top-1/2 -translate-y-1/2"
          >
            Back
          </BackButton>
        </div>
        
        <div className="w-full max-w-3xl">
          {airportLocations.map((airport, index) => {
            const hasSingleConcourse = airport.concourses.length === 1;
            
            return (
              <DropdownCard 
                key={airport.code} 
                title={`${airport.name} (${airport.code})`}
                initiallyOpen={index === 0 && !hasSingleConcourse}
                className={hasSingleConcourse ? 'cursor-pointer' : ''}
                onClick={hasSingleConcourse ? () => handleConcourseClick(airport.concourses[0].route) : undefined}
              >
                <div className="space-y-4">
                  {airport.concourses.map((concourse) => (
                    <LocationButton 
                      key={concourse.name}
                      fullWidth
                      onClick={() => handleConcourseClick(concourse.route)}
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
  );
} 