import type { IntakeCategory } from '@/data/locationData';
import type { Step, TreatmentOption, VisitCategory } from './types';

export { TREATMENTS } from '@/domain/services/catalog';

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
