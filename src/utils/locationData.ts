/**
 * Location Data Types and Utilities
 * 
 * This file contains types, data, and utility functions for 
 * managing location information across the application.
 */

// Type definitions for location data
export interface LocationInfo {
  gate: string;
  landmark: string;
  airportCode: string;
  imageUrl: string;
  customLocation: string;
  customHours: string;
}

// Type for mapping airport codes
type AirportCodeMap = Record<string, string>;

// Constants for file extensions and defaults
const IMAGE_EXTENSIONS = {
  WEBP: 'webp',
  JPEG: 'jpeg'
} as const;

const DEFAULT_VALUES = {
  AIRPORT_CODE: 'DEF',
  LANDMARK: 'Starbucks',
  GATE_NUMBER: '12',
  HOURS: '8am - 6pm CT'
} as const;

/**
 * Map of location identifiers to airport codes
 */
export const airportMap: AirportCodeMap = {
  'atlanta': 'ATL',
  'dallas': 'DFW',
  'las-vegas': 'LAS',
  'minneapolis': 'MSP',
  'houston': 'HOU'
};

/**
 * Helper function to get the image path based on airport code and concourse letter
 */
export function getImagePath(airportCode: string, concourseLetter: string, useJpeg = false): string {
  const extension = useJpeg ? IMAGE_EXTENSIONS.JPEG : IMAGE_EXTENSIONS.WEBP;
  return `/images/stores/${airportCode.toLowerCase()}-${concourseLetter.toLowerCase()}.${extension}`;
}

/**
 * Get location info for specific airport and concourse
 */
export function getLocationInfo(location: string, concourse: string, concourseName: string): LocationInfo {
  const concourseKey = `${location}-${concourse}`.toLowerCase();
  return locationDataMap[concourseKey] || getDefaultLocationInfo(location, concourseName);
}

/**
 * Generate default location info when specific data isn't available
 */
function getDefaultLocationInfo(location: string, concourseName: string): LocationInfo {
  // Extract the concourse letter from the concourse name
  const concourseLetter = concourseName.replace('Concourse ', '').charAt(0).toLowerCase();
  
  // Determine airport code from location parameter or use default
  const airportCode = (location && 
    typeof location === 'string' && 
    airportMap[location.toLowerCase()]) 
      ? airportMap[location.toLowerCase()] 
      : DEFAULT_VALUES.AIRPORT_CODE;
  
  const gatePrefix = concourseName.replace('Concourse ', '');
  
  return {
    gate: `${gatePrefix}-${DEFAULT_VALUES.GATE_NUMBER}`, 
    landmark: DEFAULT_VALUES.LANDMARK,
    airportCode,
    imageUrl: getImagePath(airportCode.toLowerCase(), concourseLetter),
    customLocation: `Near Gate ${gatePrefix}-${DEFAULT_VALUES.GATE_NUMBER}, next to ${DEFAULT_VALUES.LANDMARK}`,
    customHours: DEFAULT_VALUES.HOURS
  };
}

/**
 * Map of location data for all locations
 */
const locationDataMap: Record<string, LocationInfo> = {
  'atlanta-concourse-a': {
    gate: 'A18',
    landmark: 'Delta Help Desk',
    airportCode: 'ATL',
    imageUrl: getImagePath('atl', 'a'),
    customLocation: 'Near the main rotunda of concourse A next to the BlueWire kiosk and the Delta Help Desk',
    customHours: '7am - 7pm ET'
  },
  'dallas-concourse-a': {
    gate: 'A29',
    landmark: 'California Pizza Kitchen',
    airportCode: 'DFW',
    imageUrl: getImagePath('dfw', 'a'),
    customLocation: 'Between Gate A29 and California Pizza Kitchen',
    customHours: '7am - 7pm CT'
  },
  'houston-concourse-a': {
    gate: 'A-9',
    landmark: 'Common Bond',
    airportCode: 'HOU',
    imageUrl: getImagePath('hou', 'w'),
    customLocation: 'West Concourse near the Common Bond restaurant and gate 1',
    customHours: '8am - 6pm CT'
  },
  'las-vegas-concourse-b': {
    gate: 'B-15',
    landmark: 'Starbucks',
    airportCode: 'LAS',
    imageUrl: getImagePath('las', 'b'),
    customLocation: 'Across from Starbucks and near the walkway to concourse C',
    customHours: '8am - 6pm PT'
  },
  'las-vegas-concourse-c': {
    gate: 'C-24',
    landmark: 'Raiders memorabilia store',
    airportCode: 'LAS',
    imageUrl: getImagePath('las', 'c'),
    customLocation: 'Near gate C24 and directly across from the Raiders memorabilia store',
    customHours: '8am - 6pm PT'
  },
  'minneapolis-concourse-c': {
    gate: 'C-12',
    landmark: 'Delta SkyClub',
    airportCode: 'MSP',
    imageUrl: getImagePath('msp', 'c'),
    customLocation: 'Near gate C12 and across from Delta SkyClub',
    customHours: '7am - 8pm CT'
  },
  'minneapolis-concourse-f': {
    gate: 'F-6',
    landmark: 'Local Marketplace',
    airportCode: 'MSP',
    imageUrl: getImagePath('msp', 'f'),
    customLocation: 'Near Gate F6, across from the food court and next to the Local Marketplace',
    customHours: '7am - 8pm CT'
  },
  'minneapolis-concourse-g': {
    gate: 'G-1',
    landmark: 'help desk',
    airportCode: 'MSP',
    imageUrl: getImagePath('msp', 'g'),
    customLocation: 'At the entrance to the G concourse, across from the help desk',
    customHours: '7am - 8pm CT'
  }
}; 