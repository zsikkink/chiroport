import type { LocationInfo } from '@/utils/locationData';

export type Step =
  | 'category'
  | 'question'
  | 'join'
  | 'nonmember'
  | 'treatments'
  | 'details'
  | 'success'
  | 'massage_options';

export interface TreatmentOption {
  title: string;
  price: string;
  time: string;
  description: string;
}

export interface WizardDetails {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  discomfort: string[];
  additionalInfo: string;
  consent: boolean;
}

export interface SubmissionMeta {
  customerId: string;
  visitId: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
}

export interface WizardState {
  step: Step;
  history: Step[];
  isMember: boolean | null;
  spinalAdjustment: boolean | null;
  selectedTreatment: TreatmentOption | null;
  visitCategory: 'priority_pass' | 'chiropractor' | 'massage' | null;
  details: WizardDetails;
  submitAttempted: boolean;
  isSubmitting: boolean;
  submissionError: string | null;
  submissionSuccess: SubmissionMeta | null;
}

export type WizardAction =
  | { type: 'GO_TO'; step: Step }
  | { type: 'GO_BACK' }
  | { type: 'SET_MEMBER'; value: boolean }
  | { type: 'SET_SPINAL'; value: boolean }
  | { type: 'DESELECT_SPINAL' }
  | { type: 'SELECT_TREATMENT'; treatment: TreatmentOption }
  | { type: 'SET_VISIT_CATEGORY'; value: WizardState['visitCategory'] }
  | { type: 'CLEAR_SELECTED_TREATMENT' }
  | { type: 'UPDATE_FIELD'; field: keyof WizardState['details']; value: string | boolean }
  | { type: 'UPDATE_DISCOMFORT'; values: string[] }
  | { type: 'ATTEMPT_SUBMIT' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: SubmissionMeta }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET'; step: Step };

export interface LocationDetailsProps {
  locationInfo: LocationInfo;
  className?: string;
}

export type VisitCategory = WizardState['visitCategory'];
