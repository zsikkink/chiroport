'use client';

import ResponsiveLayout from '@/components/ResponsiveLayout';
import { useParams } from 'next/navigation';
import LocationImage from '@/components/LocationImage';
import LocationDetails from '@/components/LocationDetails';
import WaitwhileInline from '@/components/WaitwhileInline';
import ScrollHeader from '@/components/ScrollHeader';
import { getLocationInfo, findAirport, findConcourse } from '@/utils/locationData';
import { notFound } from 'next/navigation';

/**
 * CONCOURSE PAGE COMPONENT
 * 
 * This is the main page component for individual airport concourse locations.
 * It displays location-specific information and provides queue joining functionality.
 * 
 * ROUTE STRUCTURE:
 * /locations/[location]/[concourse]
 * Example: /locations/minneapolis/concourse-g
 * 
 * PAGE FLOW:
 * 1. Header with location name and navigation
 * 2. Waitwhile queue interface (primary action)
 * 3. Location details (hours, directions)
 * 4. Location photo (visual reference)
 * 
 * KEY FEATURES:
 * - Dynamic route parameter handling
 * - Responsive design across all screen sizes
 * - Integration with Waitwhile queue management
 * - Location-specific data and imagery
 * - Consistent spacing and layout system
 */
export default function ConcoursePage() {
  const params = useParams();
  const { location, concourse } = params;
  
  // Get location data - if not found, show 404
  const locationInfo = getLocationInfo(location as string, concourse as string);
  const airport = findAirport(location as string);
  const concourseInfo = findConcourse(location as string, concourse as string);
  
  if (!locationInfo || !airport || !concourseInfo) {
    notFound();
  }

  const headerTitle = `${airport.name} ${concourseInfo.displayName}`;

  return (
    <>
      <ScrollHeader title={headerTitle} />
      
      <ResponsiveLayout>
        {/* Waitwhile Queue Section */}
        <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-white lg:bg-transparent mb-8 mt-20">
          <div className="w-full max-w-7xl mx-auto px-4 py-6">
            <WaitwhileInline 
              locationId={locationInfo.waitwhileId}
              className="w-full lg:max-w-lg lg:mx-auto"
            />
          </div>
        </div>

        {/* Location Details Section */}
        <div className="w-full sm:max-w-3xl mx-auto px-4 sm:px-0 mb-8">
          <LocationDetails locationInfo={locationInfo} />
        </div>

        {/* Location Photo Section */}
        <div className="w-full sm:max-w-3xl mx-auto px-4 sm:px-0">
          <LocationImage 
            src={locationInfo.imageUrl}
            alt={`${airport.name} ${concourseInfo.displayName} Chiroport location`}
            aspectRatio="16/9"
            objectFit="cover"
            objectPosition="center center"
          />
        </div>
      </ResponsiveLayout>
    </>
  );
} 