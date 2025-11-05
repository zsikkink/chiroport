import waitwhileJson from '../../data/waitwhileLocations.json';

export type IntakeCategory = 'standard' | 'offers_massage';

export interface ServiceConfig {
  memberWithSpinal: string;
  memberWithoutSpinal: string;
  treatments: Record<string, string>;
}

export interface DataFieldIds {
  ailment: string;
  dateOfBirth: string;
  notes: string;
  consent: string;
}

export interface LocationInfoData {
  gate: string;
  landmark: string;
  airportCode: string;
  imageUrl: string;
  customLocation: string;
  customHours: string;
  displayName: string;
  waitwhileLocationId: string;
  intakeCategory?: IntakeCategory;
  dataFieldIds: DataFieldIds;
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

interface WaitwhileData {
  services: ServiceConfig;
  airports: AirportData[];
}

const waitwhileData: WaitwhileData = waitwhileJson as WaitwhileData;

function validateWaitwhileData(data: WaitwhileData): void {
  if (!data.services) {
    throw new Error('waitwhile data is missing services configuration');
  }

  const serviceIds = new Set<string>();
  serviceIds.add(data.services.memberWithSpinal);
  serviceIds.add(data.services.memberWithoutSpinal);

  Object.entries(data.services.treatments).forEach(([name, id]) => {
    if (!id) {
      throw new Error(`Missing service ID for treatment "${name}"`);
    }
    if (serviceIds.has(id)) {
      throw new Error(`Duplicate service ID detected: "${id}"`);
    }
    serviceIds.add(id);
  });

  const airportSlugs = new Set<string>();
  const waitwhileIds = new Set<string>();

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

      if (!info.waitwhileLocationId) {
        throw new Error(
          `Concourse "${concourse.slug}" in airport "${airport.name}" is missing waitwhileLocationId`
        );
      }

      if (waitwhileIds.has(info.waitwhileLocationId)) {
        throw new Error(
          `Duplicate Waitwhile location ID "${info.waitwhileLocationId}" detected`
        );
      }
      waitwhileIds.add(info.waitwhileLocationId);

      const fields = info.dataFieldIds;
      (['ailment', 'dateOfBirth', 'notes', 'consent'] as const).forEach((fieldKey) => {
        const value = fields[fieldKey];
        if (!value) {
          throw new Error(
            `Location "${info.waitwhileLocationId}" is missing dataFieldIds.${fieldKey}`
          );
        }
      });
    });
  });
}

validateWaitwhileData(waitwhileData);

export const waitwhileServices = Object.freeze(waitwhileData.services);
export const airportLocations = waitwhileData.airports;

export const intakeCategoryByLocationId: Record<string, IntakeCategory> =
  airportLocations.reduce<Record<string, IntakeCategory>>((acc, airport) => {
    airport.concourses.forEach((concourse) => {
      const category = concourse.locationInfo.intakeCategory ?? 'standard';
      acc[concourse.locationInfo.waitwhileLocationId] = category;
    });
    return acc;
  }, {});

export type { WaitwhileData };
