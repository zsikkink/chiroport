import type { IntakeCategory } from '@/data/waitwhileData';
import type { Step, TreatmentOption, VisitCategory } from './types';

export const TREATMENTS: readonly TreatmentOption[] = [
  { title: 'Body on the Go', price: '$69', time: '10 min', description: 'Full spinal and neck adjustment' },
  { title: 'Total Wellness', price: '$99', time: '20 min', description: 'Our signature service—trigger point muscle therapy, full-body stretch, and complete spinal & neck adjustments' },
  { title: 'Sciatica & Lower Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve sciatica and lower back discomfort' },
  { title: 'Neck & Upper Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve neck and upper back discomfort' },
  { title: 'Trigger Point Muscle Therapy & Stretch', price: '$89', time: '20 min', description: 'Relieve postural muscle tightness from travel, enhance blood flow, and calm your nervous system' },
  { title: 'Chiro Massage', price: '$79', time: '20 min', description: 'Thai-inspired massage blending trigger-point muscle therapy, dynamic stretching, and mechanical massagers' },
  { title: 'Chiro Massage Mini', price: '$39', time: '10 min', description: 'Thai-inspired massage blending trigger-point muscle therapy and mechanical massagers' },
  { title: 'Undecided', price: '', time: '', description: 'Not sure which therapy is right? Discuss your needs with our chiropractor to choose the best treatment' },
] as const;

export const MASSAGE_OPTIONS: readonly TreatmentOption[] = [
  { title: '15 Minutes', price: '$55', time: '', description: '' },
  { title: '20 Minutes', price: '$65', time: '', description: '' },
  { title: '30 Minutes', price: '$85', time: '', description: '' },
] as const;

export interface FlowDefinition {
  initialStep: Step;
  steps: Step[];
}

export interface FlowTransitionMap {
  afterMemberYes?: Step;
  afterMemberNo?: Step;
  afterSpinalDecision?: Step;
  afterTreatmentSelection?: Step;
  category?: Record<Exclude<VisitCategory, null>, Step>;
}

export const FLOW_CONFIG: Record<IntakeCategory, FlowDefinition> = {
  standard: {
    initialStep: 'question',
    steps: ['question', 'join', 'nonmember', 'details', 'success'],
  },
  offers_massage: {
    initialStep: 'category',
    steps: ['category', 'join', 'massage_options', 'details', 'success'],
  },
};

export const FLOW_TRANSITIONS: Record<IntakeCategory, FlowTransitionMap> = {
  standard: {
    afterMemberYes: 'join',
    afterMemberNo: 'details',
    afterSpinalDecision: 'details',
    afterTreatmentSelection: 'details',
  },
  offers_massage: {
    afterTreatmentSelection: 'details',
    category: {
      priority_pass: 'join',
      chiropractor: 'details',
      massage: 'massage_options',
    },
  },
};
