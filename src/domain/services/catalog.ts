export const OFFERING_CODES = {
  CHIROPRACTIC: 'chiropractic',
  PRIORITY_PASS: 'priority_pass',
  PRIORITY_PASS_ADJUSTMENTS: 'priority_pass_adjustments',
  MASSAGE_15: 'massage_15',
  MASSAGE_20: 'massage_20',
  MASSAGE_30: 'massage_30',
} as const;

export type OfferingCode = (typeof OFFERING_CODES)[keyof typeof OFFERING_CODES];

export type EmployeeTreatmentOption = {
  code: OfferingCode;
  label: string;
};

export const TREATMENT_OPTIONS: readonly EmployeeTreatmentOption[] = [
  { code: OFFERING_CODES.CHIROPRACTIC, label: 'Chiropractor' },
  { code: OFFERING_CODES.PRIORITY_PASS, label: 'Priority Pass' },
  {
    code: OFFERING_CODES.PRIORITY_PASS_ADJUSTMENTS,
    label: 'Priority Pass + Adjustments',
  },
  { code: OFFERING_CODES.MASSAGE_15, label: 'Massage: 15 minutes' },
  { code: OFFERING_CODES.MASSAGE_20, label: 'Massage: 20 minutes' },
  { code: OFFERING_CODES.MASSAGE_30, label: 'Massage: 30 minutes' },
] as const;
