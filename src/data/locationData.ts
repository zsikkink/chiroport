import locationJson from '../../data/locationData.json';

export type IntakeCategory = 'standard' | 'offers_massage';

export interface UiOverrides {
  massageCategoryLabel?: string;
  massageOptionsTitle?: string;
  joinServiceSummary?: string;
}

export interface LocationInfoData {
  gate: string;
  landmark: string;
  airportCode: string;
  imageUrl: string;
  customLocation: string;
  customHours: string;
  displayName: string;
  intakeCategory?: IntakeCategory;
  uiOverrides?: UiOverrides;
}

export interface ConcourseData {
  name: string;
  slug: string;
  displayName: string;
  locationInfo: LocationInfoData;
}

export interface AirportData {
  name: string;
  code: string;
  slug: string;
  concourses: ConcourseData[];
}

interface LocationData {
  airports: AirportData[];
}

const locationData: LocationData = locationJson as LocationData;

function validateLocationData(data: LocationData): void {
  const airportSlugs = new Set<string>();

  data.airports.forEach((airport) => {
    if (!airport.name || !airport.slug || !airport.code) {
      throw new Error(`Airport "${airport?.name ?? 'unknown'}" is missing required metadata`);
    }

    if (airportSlugs.has(airport.slug)) {
      throw new Error(`Duplicate airport slug detected: "${airport.slug}"`);
    }
    airportSlugs.add(airport.slug);

    const concourseSlugs = new Set<string>();

    airport.concourses.forEach((concourse) => {
      if (!concourse.name || !concourse.slug || !concourse.displayName) {
        throw new Error(
          `Concourse in airport "${airport.name}" is missing required metadata`
        );
      }

      if (concourseSlugs.has(concourse.slug)) {
        throw new Error(
          `Duplicate concourse slug "${concourse.slug}" detected in airport "${airport.name}"`
        );
      }
      concourseSlugs.add(concourse.slug);

      const info = concourse.locationInfo;
      if (
        !info.gate ||
        !info.landmark ||
        !info.airportCode ||
        !info.imageUrl ||
        !info.customLocation ||
        !info.customHours ||
        !info.displayName
      ) {
        throw new Error(
          `Location "${airport.code} ${concourse.slug}" is missing required metadata`
        );
      }
    });
  });
}

validateLocationData(locationData);

export const airportLocations = locationData.airports;
