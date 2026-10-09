import type { WizardAction, WizardState } from './types';

export const createEmptyDetails = (): WizardState['details'] => ({
  name: '',
  phone: '',
  email: '',
  consent: false,
});

export const createWizardInitialState = (): WizardState => ({
  serviceChoice: null,
  details: createEmptyDetails(),
  submitAttempted: false,
  isSubmitting: false,
  submissionError: null,
  submissionSuccess: null,
});

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SELECT_SERVICE':
      return { ...state, serviceChoice: action.value };

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
