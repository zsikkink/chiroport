/**
 * Wizard State Management Hook
 * 
 * Custom hook that manages the wizard form state using useReducer
 */

import { useReducer } from 'react';
import { WizardState, WizardAction } from '@/types/wizard';

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

export function useWizard() {
  return useReducer(wizardReducer, initialState);
} 