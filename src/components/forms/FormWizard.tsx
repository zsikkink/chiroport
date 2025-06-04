'use client';

import { useReducer } from 'react';
import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { LocationInfo } from '@/utils/locationData';
import { logger } from '@/utils/logger';

// ============================================================================
// TYPES AND DATA
// ============================================================================

const TREATMENTS = [
  { title: 'Body on the Go', price: '$69', time: '10 min', description: 'Full spinal and neck adjustment' },
  { title: 'Total Wellness', price: '$99', time: '20 min', description: 'Our signature service—trigger point muscle therapy, full-body stretch, and complete spinal & neck adjustments' },
  { title: 'Sciatica & Lower Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve sciatica and lower back discomfort' },
  { title: 'Neck & Upper Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve neck and upper back discomfort' },
  { title: 'Trigger Point Muscle Therapy & Stretch', price: '$89', time: '20 min', description: 'Relieve postural muscle tightness from travel, enhance blood flow, and calm your nervous system' },
  { title: 'Chiro Massage', price: '$79', time: '20 min', description: 'Thai-inspired massage blending trigger-point muscle therapy, dynamic stretching, and mechanical massagers' },
  { title: 'Chiro Massage Mini', price: '$39', time: '10 min', description: 'Thai-inspired massage blending trigger-point muscle therapy and mechanical massagers' },
  { title: 'Undecided', price: '', time: '', description: 'Not sure which therapy is right? Discuss your needs with our chiropractor to choose the best treatment' }
] as const;

export type Step = 'question' | 'join' | 'nonmember' | 'treatments' | 'details' | 'success';
export type Treatment = (typeof TREATMENTS)[number];

export interface FormData {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  discomfort: string[];
  additionalInfo: string;
  consent: boolean;
}

export interface WizardState {
  step: Step;
  history: Step[];
  isMember: boolean | null;
  spinalAdjustment: boolean | null;
  selectedTreatment: Treatment | null;
  details: FormData;
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

export type WizardAction =
  | { type: 'GO_TO'; step: Step }
  | { type: 'GO_BACK' }
  | { type: 'SET_MEMBER'; value: boolean }
  | { type: 'SET_SPINAL'; value: boolean }
  | { type: 'DESELECT_SPINAL' }
  | { type: 'SELECT_TREATMENT'; treatment: Treatment }
  | { type: 'UPDATE_FIELD'; field: keyof FormData; value: string | boolean }
  | { type: 'UPDATE_DISCOMFORT'; values: string[] }
  | { type: 'ATTEMPT_SUBMIT' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: { customerId: string; visitId: string; queuePosition?: number; estimatedWaitTime?: number } }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET' };

// ============================================================================
// VALIDATION
// ============================================================================

const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return false;
  
  if (phone.startsWith('+')) {
    return isValidPhoneNumber(phone);
  }
  
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return isValidPhoneNumber(`+1${digitsOnly}`);
  }
  
  return false;
};

export const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required').refine(validatePhoneNumber, 'Invalid phone number'),
  email: z.string().email('Invalid email'),
  birthday: z.string().min(1, 'Birthday is required').refine((date) => {
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
    if (!dateRegex.test(date)) return false;
    
    const parts = date.split('/').map(Number);
    const [month, day, year] = parts;
    
    // Check if all parts are valid numbers
    if (month === undefined || day === undefined || year === undefined) return false;
    
    const dateObj = new Date(year, month - 1, day);
    
    return dateObj.getFullYear() === year && 
           dateObj.getMonth() === month - 1 && 
           dateObj.getDate() === day &&
           year >= 1900 && 
           year <= new Date().getFullYear();
  }, 'Invalid date format (MM/DD/YYYY)'),
  discomfort: z.array(z.string()).min(1, 'Please select at least one option'),
  additionalInfo: z.string().optional(),
  consent: z.boolean().refine(val => val === true, 'You must consent to treatment to proceed')
});

// ============================================================================
// REDUCER
// ============================================================================

const initialState: WizardState = {
  step: 'question',
  history: [],
  isMember: null,
  spinalAdjustment: null,
  selectedTreatment: null,
  details: { name: '', phone: '', email: '', birthday: '', discomfort: [], additionalInfo: '', consent: false },
  submitAttempted: false,
  isSubmitting: false,
  submissionError: null,
  submissionSuccess: null
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  logger.userAction(`Wizard action: ${action.type}`, { step: state.step });
  
  switch (action.type) {
    case 'GO_TO':
      return {
        ...state,
        history: [...state.history, state.step],
        step: action.step,
        submitAttempted: action.step === 'details' ? false : state.submitAttempted
      };

    case 'GO_BACK':
      const previousStep = state.history[state.history.length - 1] || 'question';
      return {
        ...state,
        step: previousStep,
        history: state.history.slice(0, -1),
        submitAttempted: false
      };

    case 'SET_MEMBER':
      return { ...state, isMember: action.value };

    case 'SET_SPINAL':
      return { ...state, spinalAdjustment: action.value };

    case 'DESELECT_SPINAL':
      return { ...state, spinalAdjustment: null };

    case 'SELECT_TREATMENT':
      return { ...state, selectedTreatment: action.treatment };

    case 'UPDATE_FIELD':
      return {
        ...state,
        details: { ...state.details, [action.field]: action.value }
      };

    case 'UPDATE_DISCOMFORT':
      return {
        ...state,
        details: { ...state.details, discomfort: action.values }
      };

    case 'ATTEMPT_SUBMIT':
      return { ...state, submitAttempted: true };

    case 'SUBMIT_START':
      return { ...state, isSubmitting: true };

    case 'SUBMIT_SUCCESS':
      return {
        ...state,
        isSubmitting: false,
        submissionSuccess: action.payload,
        submissionError: null
      };

    case 'SUBMIT_ERROR':
      return {
        ...state,
        isSubmitting: false,
        submissionError: action.error
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// HOOK
// ============================================================================

export interface FormWizardProps {
  locationInfo: LocationInfo;
  onSubmit: (data: WizardState) => Promise<void>;
  children: (props: {
    state: WizardState;
    dispatch: React.Dispatch<WizardAction>;
    treatments: typeof TREATMENTS;
    goTo: (step: Step) => void;
    goBack: () => void;
    handleSubmit: () => Promise<void>;
  }) => React.ReactNode;
}

export function FormWizard({ locationInfo, onSubmit, children }: FormWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const goTo = (step: Step) => dispatch({ type: 'GO_TO', step });
  const goBack = () => dispatch({ type: 'GO_BACK' });

  const handleSubmit = async () => {
    dispatch({ type: 'ATTEMPT_SUBMIT' });

    try {
      // Validate form data
      formSchema.parse(state.details);
      
      dispatch({ type: 'SUBMIT_START' });
      
      logger.userAction('Form submission started', { 
        component: 'FormWizard',
        locationId: locationInfo.waitwhileLocationId 
      });

      await onSubmit(state);
    } catch (error) {
      logger.error('Form submission failed', error as Error, { 
        component: 'FormWizard',
        step: state.step 
      });
      
      if (error instanceof z.ZodError) {
        dispatch({ type: 'SUBMIT_ERROR', error: 'Please check your information and try again.' });
      } else {
        dispatch({ type: 'SUBMIT_ERROR', error: 'An error occurred. Please try again.' });
      }
    }
  };

  return (
    <>
      {children({
        state,
        dispatch,
        treatments: TREATMENTS,
        goTo,
        goBack,
        handleSubmit,
      })}
    </>
  );
} 