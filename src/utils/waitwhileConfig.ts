/**
 * Waitwhile integration configuration
 * Maps airport locations to their corresponding Waitwhile locationIds
 */

interface WaitwhileLocationMap {
  [key: string]: {
    [key: string]: string;
  };
}

// Map of airport/concourse combinations to Waitwhile locationIds
// Replace these placeholder IDs with actual Waitwhile locationIds for each concourse
export const waitwhileLocationIds: WaitwhileLocationMap = {
  'atlanta': {
    'concourse-a': 'waitwhile-location-id-atl-a',
    'concourse-b': 'waitwhile-location-id-atl-b',
    // Add other concourses as needed
  },
  'minneapolis': {
    'concourse-c': 'waitwhile-location-id-msp-c',
    'concourse-g': 'thechiroportmspg',
    // Add other concourses as needed
  },
  'houston': {
    'concourse-a': 'waitwhile-location-id-hou-a',
    // Add other concourses as needed
  },
  'las-vegas': {
    'concourse-c': 'waitwhile-location-id-las-c',
    // Add other concourses as needed
  },
  // Add other airports as needed
};

// Default locationId to use if specific one not found
export const defaultWaitwhileLocationId = 'waitwhile-default-location-id';

/**
 * Get the Waitwhile locationId for a specific airport concourse
 */
export function getWaitwhileLocationId(airport: string, concourse: string): string {
  if (waitwhileLocationIds[airport] && waitwhileLocationIds[airport][concourse]) {
    return waitwhileLocationIds[airport][concourse];
  }
  return defaultWaitwhileLocationId;
} 