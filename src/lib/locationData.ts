/**
 * Location Data - Simplified Structure
 *
 * Provides typed helpers on top of the JSON-based location data source.
 */

import {
  airportLocations as airportData,
  type AirportData,
  type ConcourseData,
  type LocationInfoData,
} from '@/data/locationData';

// Simplified type definitions (aliases for the shared data types)
export type LocationInfo = LocationInfoData;
export type ConcourseInfo = ConcourseData;
export type AirportLocation = AirportData;

/**
 * Deep copy the airport data so downstream mutations don't affect the shared source.
 * Intake category defaults to "standard" when omitted.
 */
export const airportLocations: AirportLocation[] = airportData.map((airport) => ({
  ...airport,
  concourses: airport.concourses.map((concourse) => ({
    ...concourse,
    locationInfo: {
      ...concourse.locationInfo,
      intakeCategory: concourse.locationInfo.intakeCategory ?? 'standard',
    },
  })),
}));

/**
 * All airport locations with embedded location data - single source of truth
 * This eliminates the need for complex lookup functions and special case handling
 */

/**
 * Simplified lookup functions - no complex fallback logic needed
 */
export function findAirport(slug: string): AirportLocation | null {
  return airportLocations.find(airport => airport.slug === slug) || null;
}

export function findConcourse(airportSlug: string, concourseSlug: string): ConcourseInfo | null {
  const airport = findAirport(airportSlug);
  if (!airport) return null;

  const directMatch = airport.concourses.find(concourse => concourse.slug === concourseSlug);
  if (directMatch) return directMatch;

  const aliasMatch = airport.concourses.find(concourse =>
    concourse.aliases?.includes(concourseSlug)
  );
  if (aliasMatch) return aliasMatch;

  return null;
}

export function getLocationInfo(airportSlug: string, concourseSlug: string): LocationInfo | null {
  const concourse = findConcourse(airportSlug, concourseSlug);
  return concourse?.locationInfo || null;
}

// Generate route paths for navigation
export function getLocationRoute(airportSlug: string, concourseSlug: string): string {
  return `/locations/${airportSlug}/${concourseSlug}`;
}
