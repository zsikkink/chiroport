export const OFFERING_CODES = {
  CHIROPRACTIC: 'chiropractic',
  PRIORITY_PASS: 'priority_pass',
  PRIORITY_PASS_ADJUSTMENTS: 'priority_pass_adjustments',
  MASSAGE_15: 'massage_15',
  MASSAGE_20: 'massage_20',
  MASSAGE_30: 'massage_30',
} as const;

export type OfferingCode = (typeof OFFERING_CODES)[keyof typeof OFFERING_CODES];

export interface IntakeTreatmentOption {
  offeringCode: OfferingCode;
  title: string;
  price: string;
  time: string;
  description: string;
}

export const TREATMENTS: readonly IntakeTreatmentOption[] = [
  {
    offeringCode: OFFERING_CODES.CHIROPRACTIC,
    title: 'Body on the Go',
    price: '$69',
    time: '10 min',
    description: 'Full spinal and neck adjustment',
  },
  {
    offeringCode: OFFERING_CODES.CHIROPRACTIC,
    title: 'Total Wellness',
    price: '$99',
    time: '20 min',
    description:
      'Our signature service—trigger point muscle therapy, full-body stretch, and complete spinal & neck adjustments',
  },
  {
    offeringCode: OFFERING_CODES.CHIROPRACTIC,
    title: 'Sciatica & Lower Back Targeted Therapy',
    price: '$119',
    time: '20 min',
    description:
      'Focused spinal adjustments and muscle work to relieve sciatica and lower back discomfort',
  },
  {
    offeringCode: OFFERING_CODES.CHIROPRACTIC,
    title: 'Neck & Upper Back Targeted Therapy',
    price: '$119',
    time: '20 min',
    description:
      'Focused spinal adjustments and muscle work to relieve neck and upper back discomfort',
  },
  {
    offeringCode: OFFERING_CODES.CHIROPRACTIC,
    title: 'Trigger Point Muscle Therapy & Stretch',
    price: '$89',
    time: '20 min',
    description:
      'Relieve postural muscle tightness from travel, enhance blood flow, and calm your nervous system',
  },
  {
    offeringCode: OFFERING_CODES.CHIROPRACTIC,
    title: 'Chiro Massage',
    price: '$79',
    time: '20 min',
    description:
      'Thai-inspired massage blending trigger-point muscle therapy, dynamic stretching, and mechanical massagers',
  },
  {
    offeringCode: OFFERING_CODES.CHIROPRACTIC,
    title: 'Chiro Massage Mini',
    price: '$39',
    time: '10 min',
    description:
      'Thai-inspired massage blending trigger-point muscle therapy and mechanical massagers',
  },
  {
    offeringCode: OFFERING_CODES.CHIROPRACTIC,
    title: 'Undecided',
    price: '',
    time: '',
    description:
      'Not sure which therapy is right? Discuss your needs with our chiropractor to choose the best treatment',
  },
] as const;

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
