import type { LocationInfo } from '@/lib';
import type { IntakeTreatmentOption } from '@/domain/services/catalog';

export type TreatmentOption = IntakeTreatmentOption;

export interface WizardDetails {
  name: string;
  phone: string;
  email: string;
  consent: boolean;
}

export interface SubmissionMeta {
  queueEntryId: string;
  publicToken: string;
  queuePosition?: number;
  alreadyInQueue?: boolean;
}

export interface WizardState {
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
  | { type: 'SET_MEMBER'; value: boolean }
  | { type: 'SET_SPINAL'; value: boolean }
  | { type: 'DESELECT_SPINAL' }
  | { type: 'SELECT_TREATMENT'; treatment: TreatmentOption }
  | { type: 'SET_VISIT_CATEGORY'; value: WizardState['visitCategory'] }
  | { type: 'CLEAR_SELECTED_TREATMENT' }
  | { type: 'UPDATE_FIELD'; field: keyof WizardState['details']; value: string | boolean }
  | { type: 'ATTEMPT_SUBMIT' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: SubmissionMeta }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET' };

export interface LocationDetailsProps {
  locationInfo: LocationInfo;
  airportCode: string;
  locationCode: string;
  className?: string;
}

export type VisitCategory = WizardState['visitCategory'];
