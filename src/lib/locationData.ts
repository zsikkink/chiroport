/**
 * Location Data - Simplified Structure
 *
 * Provides typed helpers on top of the JSON-based Waitwhile data source.
 */

import {
  airportLocations as airportData,
  waitwhileServices as waitwhileServicesConfig,
  type AirportData,
  type ConcourseData,
  type LocationInfoData,
  type ServiceConfig,
} from '@/data/waitwhileData';

// Simplified type definitions (aliases for the shared data types)
export type LocationInfo = LocationInfoData;
export type ConcourseInfo = ConcourseData;
export type AirportLocation = AirportData;

// Global service configuration (same across all locations)
export const waitwhileServices: ServiceConfig = waitwhileServicesConfig;

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
      dataFieldIds: { ...concourse.locationInfo.dataFieldIds },
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
  
  return airport.concourses.find(concourse => concourse.slug === concourseSlug) || null;
}

export function getLocationInfo(airportSlug: string, concourseSlug: string): LocationInfo | null {
  const concourse = findConcourse(airportSlug, concourseSlug);
  return concourse?.locationInfo || null;
}

// Generate route paths for navigation
export function getLocationRoute(airportSlug: string, concourseSlug: string): string {
  return `/locations/${airportSlug}/${concourseSlug}`;
}

/**
 * Find location data by Waitwhile location ID
 */
export function getLocationDataByWaitwhileId(waitwhileLocationId: string): LocationInfo | null {
  for (const airport of airportLocations) {
    for (const concourse of airport.concourses) {
      if (concourse.locationInfo.waitwhileLocationId === waitwhileLocationId) {
        return concourse.locationInfo;
      }
    }
  }
  return null;
} 
