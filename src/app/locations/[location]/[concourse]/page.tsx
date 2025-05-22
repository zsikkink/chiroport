'use client';

import ResponsiveLayout from '@/components/ResponsiveLayout';
import { useParams, useRouter } from 'next/navigation';
import LocationHeader from '@/components/LocationHeader';
import LocationImage from '@/components/LocationImage';
import LocationDetails from '@/components/LocationDetails';
import WaitwhileEmbed from '@/components/WaitwhileEmbed';
import { formatName } from '@/utils/formatters';
import {
  getLocationInfo,
  airportMap
} from '@/utils/locationData';
import { getWaitwhileLocationId } from '@/utils/waitwhileConfig';

/**
 * ConcoursePage Component
 * 
 * Displays detailed information about a specific airport concourse location
 * including an image, location description, and operating hours.
 */
export default function ConcoursePage() {
  const params = useParams();
  const router = useRouter();
  const { location, concourse } = params;
  
  // Format location and concourse names for display
  const locationName = formatName(location as string);
  let concourseName = formatName(concourse as string);
  
  // Override concourse name for Houston to show "West Concourse"
  if (location === 'houston') {
    concourseName = 'West Concourse';
  }
  
  // Get the airport code for this location
  const airportCode = airportMap[location as string] || '';
  
  // Get location-specific information
  const locationInfo = getLocationInfo(
    location as string,
    concourse as string,
    concourseName
  );
  
  // Use imageUrl directly from locationInfo instead of constructing it
  const imageUrl = locationInfo.imageUrl;
  
  // Get Waitwhile location ID for this concourse
  const waitwhileLocationId = getWaitwhileLocationId(
    location as string, 
    concourse as string
  );
  
  // Handle back button click
  const handleBackClick = () => {
    router.back();
  };

  return (
    <ResponsiveLayout>
      <main className="flex min-h-screen flex-col items-center py-6 sm:py-8 md:py-10 px-4 overflow-x-hidden">
        <LocationHeader
          locationName={locationName}
          concourseName={concourseName}
          airportCode={airportCode}
          onBackClick={handleBackClick}
        />
        
        <div className="w-full max-w-3xl">
          <LocationImage 
            src={imageUrl}
            alt={`${locationName} ${concourseName} Chiroport location`}
          />
          
          <LocationDetails locationInfo={locationInfo} />
          
          <div className="my-10 p-8 bg-blue-50/90 backdrop-blur-md rounded-xl shadow-md border border-blue-100">
            <h2 className="text-3xl font-semibold mb-6 text-center text-blue-900">Select a Service</h2>
            <p className="text-lg mb-6 text-center text-blue-800">
              Choose a service to join our virtual queue. We'll text you when it's your turn.
            </p>
            <WaitwhileEmbed 
              locationId={waitwhileLocationId}
              showServiceSelection={true}
              className="mt-4"
            />
          </div>
        </div>
      </main>
    </ResponsiveLayout>
  );
} 