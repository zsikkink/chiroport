import {
  intakeCategoryByLocationId as intakeCategoryMap,
  waitwhileServices,
  type IntakeCategory,
  type ServiceConfig,
} from '@/data/waitwhileData';

export type { IntakeCategory, ServiceConfig };

export const waitwhileServiceConfig: ServiceConfig = waitwhileServices;
export const intakeCategoryByLocationId: Record<string, IntakeCategory> = intakeCategoryMap;
