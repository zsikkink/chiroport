/**
 * Location Data - Simplified Structure
 * 
 * This file contains a simplified, explicit data structure for 
 * managing location information across the application.
 */

// Simplified type definitions
export interface LocationInfo {
  gate: string;
  landmark: string;
  airportCode: string;
  imageUrl: string;
  customLocation: string;
  customHours: string;
  displayName: string;
}

export interface AirportLocation {
  name: string;
  code: string;
  slug: string; // URL-friendly identifier
  concourses: ConcourseInfo[];
}

export interface ConcourseInfo {
  name: string;
  slug: string; // URL-friendly identifier
  displayName: string;
  locationInfo: LocationInfo;
}

/**
 * All airport locations with embedded location data - single source of truth
 * This eliminates the need for complex lookup functions and special case handling
 */
export const airportLocations: AirportLocation[] = [
  {
    name: 'Atlanta',
    code: 'ATL',
    slug: 'atlanta',
    concourses: [
      {
        name: 'concourse-a',
        slug: 'concourse-a',
        displayName: 'Concourse A',
        locationInfo: {
          gate: 'A18',
          landmark: 'Delta Help Desk',
          airportCode: 'ATL',
          imageUrl: '/images/stores/atl-a.webp',
          customLocation: 'Located near the main rotunda of Concourse A next to the BlueWire kiosk and the Delta Help Desk.',
          customHours: '7am - 7pm ET',
          displayName: 'Concourse A'
        }
      }
    ]
  },
  {
    name: 'Dallas',
    code: 'DFW',
    slug: 'dallas',
    concourses: [
      {
        name: 'concourse-a',
        slug: 'concourse-a',
        displayName: 'Concourse A',
        locationInfo: {
          gate: 'A29',
          landmark: 'California Pizza Kitchen',
          airportCode: 'DFW',
          imageUrl: '/images/stores/dfw-a.webp',
          customLocation: 'Located between Gate A29 and California Pizza Kitchen.',
          customHours: '7am - 7pm CT',
          displayName: 'Concourse A'
        }
      }
    ]
  },
  {
    name: 'Houston',
    code: 'HOU',
    slug: 'houston',
    concourses: [
      {
        name: 'concourse-a',
        slug: 'concourse-a',
        displayName: 'West Concourse', // Explicit display name - no special case needed
        locationInfo: {
          gate: 'A-9',
          landmark: 'Common Bond',
          airportCode: 'HOU',
          imageUrl: '/images/stores/hou-w.webp',
          customLocation: 'Located in the West Concourse near the Common Bond restaurant and Gate 1.',
          customHours: '8am - 6pm CT',
          displayName: 'West Concourse'
        }
      }
    ]
  },
  {
    name: 'Las Vegas',
    code: 'LAS',
    slug: 'las-vegas',
    concourses: [
      {
        name: 'concourse-b',
        slug: 'concourse-b',
        displayName: 'Concourse B',
        locationInfo: {
          gate: 'B-15',
          landmark: 'Starbucks',
          airportCode: 'LAS',
          imageUrl: '/images/stores/las-b.webp',
          customLocation: 'Located across from Starbucks and near the walkway to Concourse C.',
          customHours: '8am - 6pm PT',
          displayName: 'Concourse B'
        }
      },
      {
        name: 'concourse-c',
        slug: 'concourse-c',
        displayName: 'Concourse C',
        locationInfo: {
          gate: 'C-24',
          landmark: 'Raiders memorabilia store',
          airportCode: 'LAS',
          imageUrl: '/images/stores/las-c.webp',
          customLocation: 'Located near Gate C24 and directly across from the Raiders memorabilia store.',
          customHours: '8am - 6pm PT',
          displayName: 'Concourse C'
        }
      }
    ]
  },
  {
    name: 'Minneapolis',
    code: 'MSP',
    slug: 'minneapolis',
    concourses: [
      {
        name: 'concourse-c',
        slug: 'concourse-c',
        displayName: 'Concourse C',
        locationInfo: {
          gate: 'C-12',
          landmark: 'Delta SkyClub',
          airportCode: 'MSP',
          imageUrl: '/images/stores/msp-c.webp',
          customLocation: 'Located near Gate C12 and across from Delta SkyClub.',
          customHours: '7am - 8pm CT',
          displayName: 'Concourse C'
        }
      },
      {
        name: 'concourse-f',
        slug: 'concourse-f',
        displayName: 'Concourse F',
        locationInfo: {
          gate: 'F-6',
          landmark: 'Local Marketplace',
          airportCode: 'MSP',
          imageUrl: '/images/stores/msp-f.webp',
          customLocation: 'Located near Gate F6, across from the food court and next to the Local Marketplace.',
          customHours: '7am - 8pm CT',
          displayName: 'Concourse F'
        }
      },
      {
        name: 'concourse-g',
        slug: 'concourse-g',
        displayName: 'Concourse G',
        locationInfo: {
          gate: 'G-1',
          landmark: 'help desk',
          airportCode: 'MSP',
          imageUrl: '/images/stores/msp-g.webp',
          customLocation: 'Located at the entrance to the G concourse, across from the help desk.',
          customHours: '7am - 8pm CT',
          displayName: 'Concourse G'
        }
      }
    ]
  }
];

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