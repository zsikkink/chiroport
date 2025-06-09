/**
 * Wizard Form Types
 * 
 * Type definitions for the multi-step form wizard
 */

import { TREATMENTS } from '@/constants/treatments';

// Wizard step enumeration
export type Step = 
  | 'question'
  | 'join'
  | 'nonmember'
  | 'treatments'
  | 'details'
  | 'success';

// Treatment type derived from constants
export type Treatment = (typeof TREATMENTS)[number];

// Wizard state interface
export interface WizardState {
  step: Step;
  history: Step[];
  isMember: boolean | null;
  spinalAdjustment: boolean | null;
  selectedTreatment: Treatment | null;
  details: {
    name: string;
    phone: string;
    email: string;
    birthday: string;
    discomfort: string[];
    additionalInfo: string;
    consent: boolean;
  };
  submitAttempted: boolean;
  isSubmitting: boolean;
  submissionError: string | null;
  submissionSuccess: {
    customerId: string;
    visitId: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
  } | null;
}

// Wizard action types
export type WizardAction =
  | { type: 'GO_TO'; step: Step }
  | { type: 'GO_BACK' }
  | { type: 'SET_MEMBER'; value: boolean }
  | { type: 'SET_SPINAL'; value: boolean }
  | { type: 'DESELECT_SPINAL' }
  | { type: 'SELECT_TREATMENT'; treatment: Treatment }
  | { type: 'UPDATE_FIELD'; field: keyof WizardState['details']; value: string | boolean }
  | { type: 'UPDATE_DISCOMFORT'; values: string[] }
  | { type: 'ATTEMPT_SUBMIT' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: { customerId: string; visitId: string; queuePosition?: number; estimatedWaitTime?: number } }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET' };

// Form submission response interface
export interface SubmissionResponse {
  visitId: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
} 