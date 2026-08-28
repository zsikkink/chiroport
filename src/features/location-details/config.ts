import type { TreatmentOption } from './types';
import { OFFERING_CODES } from '@/domain/services/catalog';

export { TREATMENTS } from '@/domain/services/catalog';

export const MASSAGE_OPTIONS: readonly TreatmentOption[] = [
  {
    offeringCode: OFFERING_CODES.MASSAGE_15,
    title: '15 Minutes',
    price: '$55',
    time: '',
    description: '',
  },
  {
    offeringCode: OFFERING_CODES.MASSAGE_20,
    title: '20 Minutes',
    price: '$65',
    time: '',
    description: '',
  },
  {
    offeringCode: OFFERING_CODES.MASSAGE_30,
    title: '30 Minutes',
    price: '$85',
    time: '',
    description: '',
  },
] as const;
