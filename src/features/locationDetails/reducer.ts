import type { Step, WizardAction, WizardState } from './types';

export const createEmptyDetails = (): WizardState['details'] => ({
  name: '',
  phone: '',
  email: '',
  birthday: '',
  discomfort: [],
  additionalInfo: '',
  consent: false,
});

export const createWizardInitialState = (initialStep: Step): WizardState => ({
  step: initialStep,
  history: [],
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
    case 'GO_TO':
      return {
        ...state,
        ...(action.step === 'category'
          ? {
              visitCategory: null,
              isMember: null,
              spinalAdjustment: null,
              selectedTreatment: null,
            }
          : {}),
        history: [...state.history, state.step],
        step: action.step,
        submitAttempted: action.step === 'details' ? false : state.submitAttempted,
      };

    case 'GO_BACK':
      const previousStep = state.history[state.history.length - 1] || 'question';
      return {
        ...state,
        ...(previousStep === 'category'
          ? {
              visitCategory: null,
              isMember: null,
              spinalAdjustment: null,
              selectedTreatment: null,
            }
          : {}),
        step: previousStep,
        history: state.history.slice(0, -1),
        submitAttempted: false,
      };

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

    case 'UPDATE_DISCOMFORT':
      return {
        ...state,
        details: { ...state.details, discomfort: action.values },
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
      return createWizardInitialState(action.step);

    default:
      return state;
  }
}
