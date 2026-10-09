import { OFFERING_CODES, type OfferingCode } from '@/domain/services/catalog';

export type MassageOption = {
  offeringCode: OfferingCode;
  title: string;
  price: string;
};

export const MASSAGE_OPTIONS: readonly MassageOption[] = [
  {
    offeringCode: OFFERING_CODES.MASSAGE_15,
    title: '15 Minutes',
    price: '$55',
  },
  {
    offeringCode: OFFERING_CODES.MASSAGE_20,
    title: '20 Minutes',
    price: '$65',
  },
  {
    offeringCode: OFFERING_CODES.MASSAGE_30,
    title: '30 Minutes',
    price: '$85',
  },
] as const;
