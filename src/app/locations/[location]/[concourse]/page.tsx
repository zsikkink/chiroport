import StaticLayout from '@/components/layout/StaticLayout';
import { getLocationInfo, findAirport, findConcourse, airportLocations } from '@/utils/locationData';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ScrollHeader from '@/components/layout/ScrollHeader';
import LocationDetails from '@/features/location-details/LocationDetails';

interface PageParams {
  location: string;
  concourse: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

/**
 * Generate static paths for all location/concourse combinations
 * This enables static generation for better performance and SEO
 */
export async function generateStaticParams() {
  const paths: { location: string; concourse: string }[] = [];
  
  airportLocations.forEach((airport) => {
    airport.concourses.forEach((concourse) => {
      paths.push({
        location: airport.slug,
        concourse: concourse.slug,
      });
    });
  });

  return paths;
}

/**
 * Generate metadata for each location page
 * Improves SEO with dynamic titles and descriptions
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { location, concourse } = await params;
  const airport = findAirport(location);
  const concourseInfo = findConcourse(location, concourse);
  
  if (!airport || !concourseInfo) {
    return {
      title: 'Location Not Found | Chiroport',
      description: 'The requested location was not found.',
    };
  }

  return {
    title: `${airport.name} ${concourseInfo.displayName} | Chiroport`,
    description: `Walk-in chiropractic services at ${airport.name} Airport ${concourseInfo.displayName}. Join the queue for quick, professional wellness care while you travel.`,
    openGraph: {
      title: `${airport.name} ${concourseInfo.displayName} | Chiroport`,
      description: `Walk-in chiropractic services at ${airport.name} Airport ${concourseInfo.displayName}`,
      images: [
        {
          url: concourseInfo.locationInfo.imageUrl,
          width: 1200,
          height: 630,
          alt: `${airport.name} ${concourseInfo.displayName} Chiroport location`,
        },
      ],
    },
  };
}

/**
 * CONCOURSE PAGE COMPONENT (Server-Side Rendered)
 * 
 * This is the main page component for individual airport concourse locations.
 * Now server-rendered with static generation for optimal performance and SEO.
 * Uses StaticLayout for server-side rendering and direct imports for client components.
 * 
 * ROUTE STRUCTURE:
 * /locations/[location]/[concourse]
 * Example: /locations/minneapolis/concourse-g
 * 
 * PAGE FLOW:
 * 1. Header with location name and navigation (client-side)
 * 2. Location details form (client-side)
 * 
 * KEY FEATURES:
 * - Static generation for all routes
 * - SEO-optimized metadata
 * - Server-side rendering for initial content
 * - Client components hydrated after initial render
 * - No hooks in server components
 */
export default async function ConcoursePage({ params }: PageProps) {
  const { location, concourse } = await params;
  
  // Get location data - if not found, show 404
  const locationInfo = getLocationInfo(location, concourse);
  const airport = findAirport(location);
  const concourseInfo = findConcourse(location, concourse);
  
  if (!locationInfo || !airport || !concourseInfo) {
    notFound();
  }

  const headerTitle = `${airport.code} ${concourseInfo.displayName}`;

  return (
    <>
      <ScrollHeader title={headerTitle} />
      
      <StaticLayout>
        {/* Location Details Section - Client component */}
        <div className="w-full sm:max-w-3xl mx-auto px-4 sm:px-0 mt-20">
          <LocationDetails locationInfo={locationInfo} />
        </div>
      </StaticLayout>
    </>
  );
} 
