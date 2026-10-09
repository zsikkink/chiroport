import { ScrollHeader, StaticLayout } from '@/components/layout';
import { getLocationInfo, findAirport, findConcourse, airportLocations } from '@/lib';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { LocationDetails } from '@/features/location-details';

interface PageParams {
  location: string;
  concourse: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

const closedLocations = [
  { location: 'dallas', concourse: 'concourse-a', name: 'DFW Concourse A' },
  { location: 'atlanta', concourse: 'concourse-a', name: 'Atlanta Concourse A' },
  { location: 'las-vegas', concourse: 'concourse-b', name: 'Las Vegas Concourse B' },
] as const;

function getClosedLocation(location: string, concourse: string) {
  return closedLocations.find(
    (closed) => closed.location === location && closed.concourse === concourse
  );
}

/**
 * Generate static paths for all location/concourse combinations
 * This enables static generation for better performance and SEO
 */
export async function generateStaticParams() {
  const paths: { location: string; concourse: string }[] = closedLocations.map(
    ({ location, concourse }) => ({ location, concourse })
  );
  
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
  const closedLocation = getClosedLocation(location, concourse);
  if (closedLocation) {
    return {
      title: `${closedLocation.name} Closed | Chiroport`,
      description: `The Chiroport at ${closedLocation.name} is closed. View our open locations.`,
      robots: { index: false, follow: true },
    };
  }

  const airport = findAirport(location);
  const concourseInfo = findConcourse(location, concourse);
  
  if (!airport || !concourseInfo) {
    return {
      title: 'Location Not Found | Chiroport',
      description: 'The requested location was not found.',
    };
  }

  const isMassageOnly = concourseInfo.locationInfo.intakeCategory === 'massage_only';
  const description = isMassageOnly
    ? `Walk-in massage services at ${airport.name} Airport ${concourseInfo.displayName}. Join the queue for quick, professional bodywork while you travel.`
    : `Walk-in chiropractic services at ${airport.name} Airport ${concourseInfo.displayName}. Join the queue for quick, professional wellness care while you travel.`;
  const openGraphDescription = isMassageOnly
    ? `Walk-in massage services at ${airport.name} Airport ${concourseInfo.displayName}`
    : `Walk-in chiropractic services at ${airport.name} Airport ${concourseInfo.displayName}`;

  return {
    title: `${airport.name} ${concourseInfo.displayName} | Chiroport`,
    description,
    openGraph: {
      title: `${airport.name} ${concourseInfo.displayName} | Chiroport`,
      description: openGraphDescription,
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
  const closedLocation = getClosedLocation(location, concourse);
  if (closedLocation) {
    return (
      <>
        <ScrollHeader title={closedLocation.name} />
        <StaticLayout>
          <main className="mx-auto mt-20 max-w-2xl px-4 text-center">
            <h1 className="text-3xl font-bold text-slate-900">This location is closed</h1>
            <p className="mt-4 text-lg text-slate-700">
              The Chiroport at {closedLocation.name} is no longer accepting check-ins.
            </p>
            <Link
              href="/#locations"
              className="mt-6 inline-block rounded-xl bg-[var(--color-header)] px-6 py-3 font-semibold text-white hover:bg-[var(--color-primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              View open locations
            </Link>
          </main>
        </StaticLayout>
      </>
    );
  }
  
  // Get location data - if not found, show 404
  const locationInfo = getLocationInfo(location, concourse);
  const airport = findAirport(location);
  const concourseInfo = findConcourse(location, concourse);
  
  if (!locationInfo || !airport || !concourseInfo) {
    notFound();
  }

  const locationLabel = `${airport.code} · ${concourseInfo.displayName}`;

  return (
    <>
      <ScrollHeader title={locationLabel} />
      
      <StaticLayout>
        {/* Location Details Section - Client component */}
        <div className="w-full sm:max-w-3xl mx-auto px-4 sm:px-0 mt-20">
          <h1 className="text-size-stable mb-4 text-center text-[32px] leading-tight sm:text-[34px] font-bold tracking-tight text-slate-900">
            Check-in Questions
          </h1>
          <LocationDetails
            locationInfo={locationInfo}
            airportCode={airport.code}
            locationCode={concourseInfo.slug}
          />
        </div>
      </StaticLayout>
    </>
  );
} 
