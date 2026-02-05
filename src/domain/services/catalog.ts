import type { TreatmentOption as IntakeTreatmentOption } from '@/features/location-details/types';

export const TREATMENTS: readonly IntakeTreatmentOption[] = [
  {
    title: 'Body on the Go',
    price: '$69',
    time: '10 min',
    description: 'Full spinal and neck adjustment',
  },
  {
    title: 'Total Wellness',
    price: '$99',
    time: '20 min',
    description:
      'Our signature service—trigger point muscle therapy, full-body stretch, and complete spinal & neck adjustments',
  },
  {
    title: 'Sciatica & Lower Back Targeted Therapy',
    price: '$119',
    time: '20 min',
    description:
      'Focused spinal adjustments and muscle work to relieve sciatica and lower back discomfort',
  },
  {
    title: 'Neck & Upper Back Targeted Therapy',
    price: '$119',
    time: '20 min',
    description:
      'Focused spinal adjustments and muscle work to relieve neck and upper back discomfort',
  },
  {
    title: 'Trigger Point Muscle Therapy & Stretch',
    price: '$89',
    time: '20 min',
    description:
      'Relieve postural muscle tightness from travel, enhance blood flow, and calm your nervous system',
  },
  {
    title: 'Chiro Massage',
    price: '$79',
    time: '20 min',
    description:
      'Thai-inspired massage blending trigger-point muscle therapy, dynamic stretching, and mechanical massagers',
  },
  {
    title: 'Chiro Massage Mini',
    price: '$39',
    time: '10 min',
    description:
      'Thai-inspired massage blending trigger-point muscle therapy and mechanical massagers',
  },
  {
    title: 'Undecided',
    price: '',
    time: '',
    description:
      'Not sure which therapy is right? Discuss your needs with our chiropractor to choose the best treatment',
  },
] as const;

export type EmployeeTreatmentOption = {
  label: string;
  customerType: 'paying' | 'priority_pass';
};

export const TREATMENT_OPTIONS: readonly EmployeeTreatmentOption[] = [
  { label: 'Chiropractor', customerType: 'paying' },
  { label: 'Priority Pass', customerType: 'priority_pass' },
  { label: 'Priority Pass + Adjustments', customerType: 'paying' },
  { label: 'Massage: 15 minutes', customerType: 'paying' },
  { label: 'Massage: 20 minutes', customerType: 'paying' },
  { label: 'Massage: 30 minutes', customerType: 'paying' },
] as const;
