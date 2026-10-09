import type { LocationInfo } from '@/lib';
import type { OfferingCode } from '@/domain/services/catalog';

export type ServiceChoice =
  | OfferingCode
  | 'priority_pass_pending'
  | 'massage_pending';

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
  serviceChoice: ServiceChoice | null;
  details: WizardDetails;
  submitAttempted: boolean;
  isSubmitting: boolean;
  submissionError: string | null;
  submissionSuccess: SubmissionMeta | null;
}

export type WizardAction =
  | { type: 'SELECT_SERVICE'; value: ServiceChoice }
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
