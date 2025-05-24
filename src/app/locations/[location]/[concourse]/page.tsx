'use client';

import ResponsiveLayout from '@/components/ResponsiveLayout';
import { useParams, useRouter } from 'next/navigation';
import LocationHeader from '@/components/LocationHeader';
import LocationImage from '@/components/LocationImage';
import LocationDetails from '@/components/LocationDetails';
import WaitwhileInline from '@/components/WaitwhileInline';
import { formatName } from '@/utils/formatters';
import {
  getLocationInfo,
  airportMap
} from '@/utils/locationData';

/**
 * WAITWHILE LOCATION ID MAPPING
 * 
 * Maps route parameters (location-concourse) to actual Waitwhile location IDs.
 * This is the central configuration for connecting each airport concourse
 * to its corresponding queue management system.
 * 
 * HOW TO ADD NEW LOCATIONS:
 * 1. Add a new entry following the pattern: 'airport-concourse-letter': 'waitwhile-id'
 * 2. Ensure the key matches your route structure (e.g., 'chicago-concourse-b')
 * 3. Get the actual Waitwhile location ID from your Waitwhile dashboard
 * 
 * @param location - The airport identifier from the URL (e.g., 'minneapolis')
 * @param concourse - The concourse identifier from the URL (e.g., 'concourse-c')
 * @returns The corresponding Waitwhile location ID for queue integration
 */
function getWaitwhileLocationId(location: string, concourse: string): string {
  // Central mapping of all airport-concourse combinations to Waitwhile IDs
  const locationConcourseMap: Record<string, string> = {
    'atlanta-concourse-a': 'atlanta-placeholder-id', // TODO: Replace with actual Waitwhile ID
    'dallas-concourse-a': 'dfwa29',
    'houston-concourse-a': 'houstonhobby',
    'las-vegas-concourse-b': 'lasbacrossfromstarbu',
    'las-vegas-concourse-c': 'lasvegasc24',
    'minneapolis-concourse-c': 'thechiroport573',
    'minneapolis-concourse-f': 'chiroportmspf8081',
    'minneapolis-concourse-g': 'thechiroportmspg',
  };

  // Create lookup key from URL parameters
  const key = `${location}-${concourse}`;
  
  // Return mapped ID or fallback to default (useful for testing/development)
  return locationConcourseMap[key] || 'default-location-id';
}

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
  // ROUTING AND NAVIGATION SETUP
  // Extract dynamic route parameters and set up navigation
  const params = useParams();
  const router = useRouter();
  const { location, concourse } = params;
  
  // DATA PROCESSING AND FORMATTING
  // Convert URL-friendly parameters into display-ready format
  const locationName = formatName(location as string); // 'minneapolis' → 'Minneapolis'
  let concourseName = formatName(concourse as string); // 'concourse-g' → 'Concourse G'
  
  // SPECIAL CASE HANDLING
  // Some locations have custom display names that don't follow the standard pattern
  if (location === 'houston') {
    concourseName = 'West Concourse'; // Houston uses 'West Concourse' instead of 'Concourse A'
  }
  
  // LOCATION DATA RETRIEVAL
  // Get airport code for display purposes (e.g., 'MSP', 'ATL')
  const airportCode = airportMap[location as string] || '';
  
  // Fetch comprehensive location information including hours, directions, and images
  const locationInfo = getLocationInfo(
    location as string,
    concourse as string,
    concourseName
  );
  
  // Extract optimized image URL (supports both WebP and JPEG fallbacks)
  const imageUrl = locationInfo.imageUrl;
  
  // WAITWHILE INTEGRATION SETUP
  // Get the specific Waitwhile location ID for this concourse's queue system
  const waitwhileLocationId = getWaitwhileLocationId(
    location as string, 
    concourse as string
  );
  
  // NAVIGATION HANDLERS
  // Note: Back button functionality has been removed from the application

  /**
   * IMAGE DISPLAY CONFIGURATION
   * 
   * Different locations may require different image display settings
   * based on the photo composition and aspect ratio.
   * 
   * CUSTOMIZATION GUIDE:
   * - aspectRatio: Controls the container's aspect ratio ('16/9', '4/3', etc.)
   * - objectFit: How the image fills the container ('cover', 'contain', etc.)
   * - objectPosition: Which part of the image to focus on ('center', 'top', etc.)
   * - preserveAspectRatio: Whether to maintain the original image proportions
   */
  const getImageSettings = () => {
    // Special case: Atlanta concourse A has specific image requirements
    if (location === 'atlanta' && concourse === 'concourse-a') {
      return {
        preserveAspectRatio: true,
        objectPosition: 'center center'
      };
    }
    
    // Default settings work well for most location photos
    return {
      aspectRatio: '16/9',           // Standard widescreen ratio
      objectFit: 'cover' as const,   // Fill container while maintaining aspect ratio
      objectPosition: 'center center' // Focus on center of image
    };
  };

  // Apply image settings for this specific location
  const imageSettings = getImageSettings();

  // COMPONENT RENDER
  return (
    <ResponsiveLayout>
      {/* 
        SPACING CONTROL GUIDE (UPDATED):
        - Single ResponsiveLayout wrapper prevents compound spacing
        - Each section uses only bottom margin for consistent gaps
        - ResponsiveLayout provides: pt-4 sm:pt-6 md:pt-8 pb-4
        - Section spacing: mb-8 (standard) or mb-4 (tight)
        
        BEST PRACTICES:
        - Use mb-* (margin-bottom) instead of pb-* to avoid compound spacing
        - Single layout wrapper for consistent max-width and responsive behavior
        - Sections flow naturally without overlapping container padding
      */}
      
      {/* HEADER SECTION - Natural top padding from ResponsiveLayout */}
      <main className="flex flex-col items-center px-0 sm:px-4 overflow-x-hidden mb-8">
        <LocationHeader
          locationName={locationName}      // e.g., "Minneapolis"
          concourseName={concourseName}    // e.g., "Concourse G"
          airportCode={airportCode}        // e.g., "MSP"
        />
      </main>

      {/* 
        WAITWHILE QUEUE SECTION (PRIMARY ACTION)
        
        Breaking out of ResponsiveLayout for full-width white background on mobile.
        This is an exception to the single-wrapper pattern for design reasons.
      */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-white lg:bg-transparent mb-8">
        <div className="w-full max-w-7xl mx-auto px-4 py-6">
          <WaitwhileInline 
            locationId={waitwhileLocationId}                    // Connects to specific queue
            className="w-full lg:max-w-lg lg:mx-auto"          // Responsive sizing
          />
        </div>
      </div>

      {/* LOCATION DETAILS SECTION - Standard spacing */}
      <div className="w-full sm:max-w-3xl mx-auto px-4 sm:px-0 mb-8">
        <LocationDetails locationInfo={locationInfo} />
      </div>

      {/* LOCATION PHOTO SECTION - No bottom margin since it's last */}
      <div className="w-full sm:max-w-3xl mx-auto px-4 sm:px-0">
        <LocationImage 
          src={imageUrl}
          alt={`${locationName} ${concourseName} Chiroport location`}
          aspectRatio={imageSettings.aspectRatio}
          objectFit={imageSettings.objectFit}
          objectPosition={imageSettings.objectPosition}
          preserveAspectRatio={imageSettings.preserveAspectRatio}
        />
      </div>
    </ResponsiveLayout>
  );
} 