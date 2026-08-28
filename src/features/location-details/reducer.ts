import type { WizardAction, WizardState } from './types';

export const createEmptyDetails = (): WizardState['details'] => ({
  name: '',
  phone: '',
  email: '',
  consent: false,
});

export const createWizardInitialState = (): WizardState => ({
  isMember: null,
  spinalAdjustment: null,
  selectedTreatment: null,
  visitCategory: null,
  details: createEmptyDetails(),
  submitAttempted: false,
  isSubmitting: false,
  submissionError: null,
  submissionSuccess: null,
});

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_MEMBER':
      return { ...state, isMember: action.value };

    case 'SET_SPINAL':
      return { ...state, spinalAdjustment: action.value };

    case 'DESELECT_SPINAL':
      return { ...state, spinalAdjustment: null };

    case 'SELECT_TREATMENT':
      return { ...state, selectedTreatment: action.treatment };

    case 'SET_VISIT_CATEGORY':
      return { ...state, visitCategory: action.value };

    case 'CLEAR_SELECTED_TREATMENT':
      return { ...state, selectedTreatment: null };

    case 'UPDATE_FIELD':
      return {
        ...state,
        details: { ...state.details, [action.field]: action.value },
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
        submissionError: null,
      };

    case 'SUBMIT_ERROR':
      return {
        ...state,
        isSubmitting: false,
        submissionError: action.error,
      };

    case 'RESET':
      return createWizardInitialState();

    default:
      return state;
  }
}
