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
  waitwhileId: string;
  displayName: string; // Add explicit display name
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
          customLocation: 'Near the main rotunda of concourse A next to the BlueWire kiosk and the Delta Help Desk',
          customHours: '7am - 7pm ET',
          waitwhileId: 'atlanta-placeholder-id',
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
          customLocation: 'Between Gate A29 and California Pizza Kitchen',
          customHours: '7am - 7pm CT',
          waitwhileId: 'dfwa29',
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
          customLocation: 'West Concourse near the Common Bond restaurant and gate 1',
          customHours: '8am - 6pm CT',
          waitwhileId: 'houstonhobby',
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
          customLocation: 'Across from Starbucks and near the walkway to concourse C',
          customHours: '8am - 6pm PT',
          waitwhileId: 'lasbacrossfromstarbu',
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
          customLocation: 'Near gate C24 and directly across from the Raiders memorabilia store',
          customHours: '8am - 6pm PT',
          waitwhileId: 'lasvegasc24',
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
          customLocation: 'Near gate C12 and across from Delta SkyClub',
          customHours: '7am - 8pm CT',
          waitwhileId: 'thechiroport573',
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
          customLocation: 'Near Gate F6, across from the food court and next to the Local Marketplace',
          customHours: '7am - 8pm CT',
          waitwhileId: 'chiroportmspf8081',
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
          customLocation: 'At the entrance to the G concourse, across from the help desk',
          customHours: '7am - 8pm CT',
          waitwhileId: 'thechiroportmspg',
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

// Legacy compatibility - can be removed once all components are updated
export const airportMap: Record<string, string> = {
  'atlanta': 'ATL',
  'dallas': 'DFW',
  'las-vegas': 'LAS',
  'minneapolis': 'MSP',
  'houston': 'HOU'
}; 