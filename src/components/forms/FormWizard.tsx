'use client';


import { z } from 'zod';
import { LocationInfo } from '@/utils/locationData';
import { logger } from '@/utils/logger';
import { TREATMENTS } from '@/constants/treatments';
import { 
  Step, 
  WizardState, 
  WizardAction 
} from '@/types/wizard';
import { detailsSchema } from '@/validation/detailsSchema';
import { useWizard } from '@/hooks/useWizard';

// ============================================================================
// TYPES AND DATA
// ============================================================================
// Constants and types now imported from centralized modules

// ============================================================================
// VALIDATION
// ============================================================================
// Schema now imported from @/validation/detailsSchema

// ============================================================================
// REDUCER
// ============================================================================
// Reducer logic now in @/hooks/useWizard

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
  const [state, dispatch] = useWizard();

  const goTo = (step: Step) => dispatch({ type: 'GO_TO', step });
  const goBack = () => dispatch({ type: 'GO_BACK' });

  const handleSubmit = async () => {
    dispatch({ type: 'ATTEMPT_SUBMIT' });

    try {
      // Validate form data
      detailsSchema.parse(state.details);
      
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