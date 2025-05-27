'use client';

import ResponsiveLayout from '@/components/ResponsiveLayout';
import { useParams } from 'next/navigation';
import LocationDetails from '@/components/LocationDetails';
import ScrollHeader from '@/components/ScrollHeader';
import { getLocationInfo, findAirport, findConcourse } from '@/utils/locationData';
import { notFound } from 'next/navigation';

/**
 * CONCOURSE PAGE COMPONENT
 * 
 * This is the main page component for individual airport concourse locations.
 * It displays location-specific information for chiropractic services.
 * 
 * ROUTE STRUCTURE:
 * /locations/[location]/[concourse]
 * Example: /locations/minneapolis/concourse-g
 * 
 * PAGE FLOW:
 * 1. Header with location name and navigation
 * 2. Location details (hours, directions, contact info)
 * 
 * KEY FEATURES:
 * - Dynamic route parameter handling
 * - Responsive design across all screen sizes
 * - Location-specific data display
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
        {/* Location Details Section */}
        <div className="w-full sm:max-w-3xl mx-auto px-4 sm:px-0 mt-20">
          <LocationDetails locationInfo={locationInfo} />
        </div>
      </ResponsiveLayout>
    </>
  );
} 