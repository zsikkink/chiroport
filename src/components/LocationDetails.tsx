'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import 'react-phone-number-input/style.css';

import ResponsiveCard from './ResponsiveCard';
import { BodyText } from './Typography';
import { LocationInfo } from '@/utils/locationData';

import { joinQueue } from '@/services/queueApi';
import { Step, Treatment, WizardState } from '@/types/wizard';
import { useWizard } from '@/hooks/useWizard';
import { detailsSchema } from '@/validation/detailsSchema';
import { fadeVariants } from '@/ui/animation/fadeVariants';

import { 
  MembershipStep,
  JoinStep,
  NonMemberStep,
  TreatmentsStep,
  DetailsStep,
  SuccessStep
} from '@/ui/steps';

export default function LocationDetails({ 
  locationInfo, 
  className = '' 
}: { 
  locationInfo: LocationInfo; 
  className?: string;
}) {
  const [state, dispatch] = useWizard();

  // Scroll to top when navigating between service menu and details
  useEffect(() => {
    if (state.step === 'treatments' || state.step === 'details') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.step]);

  const goTo = (step: Step) => dispatch({ type: 'GO_TO', step });
  const goBack = () => dispatch({ type: 'GO_BACK' });

  const stepHandlers = {
    setMember: (value: boolean) => {
      dispatch({ type: 'SET_MEMBER', value });
      goTo(value ? 'join' : 'treatments');
    },
    setSpinal: (value: boolean) => {
      dispatch({ type: 'SET_SPINAL', value });
      goTo('details');
    },
    selectTreatment: (treatment: Treatment) => {
      dispatch({ type: 'SELECT_TREATMENT', treatment });
      goTo('details');
    },
    updateField: (field: keyof WizardState['details'], value: string | boolean) => 
      dispatch({ type: 'UPDATE_FIELD', field, value })
  };

  const handleSubmit = async () => {
    dispatch({ type: 'ATTEMPT_SUBMIT' });
    
    const validation = detailsSchema.safeParse(state.details);
    if (!validation.success) {
      return; // Form validation failed, errors will be shown
    }

    // Start submission
    dispatch({ type: 'SUBMIT_START' });

    try {
      // Submit using queue API service
      const responseData = await joinQueue({
        details: state.details,
        selectedTreatment: state.selectedTreatment,
        spinalAdjustment: state.spinalAdjustment,
        locationId: locationInfo.waitwhileLocationId
      });

      // Success - prepare payload for state
      const payload: { customerId: string; visitId: string; queuePosition?: number; estimatedWaitTime?: number } = {
        customerId: '', // Not needed with new API structure
        visitId: responseData.visitId,
      };
      
      if (responseData.queuePosition !== undefined) {
        payload.queuePosition = responseData.queuePosition;
      }
      
      if (responseData.estimatedWaitTime !== undefined) {
        payload.estimatedWaitTime = responseData.estimatedWaitTime;
      }
      
      dispatch({
        type: 'SUBMIT_SUCCESS',
        payload
      });

      // Navigate to success step
      goTo('success');

    } catch (error) {
      dispatch({
        type: 'SUBMIT_ERROR',
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    }
  };

  const renderStep = () => {
    let stepComponent;

    switch (state.step) {
      case 'question':
        stepComponent = (
          <MembershipStep
            onYes={() => stepHandlers.setMember(true)}
            onNo={() => stepHandlers.setMember(false)}
          />
        );
        break;

      case 'join':
        stepComponent = (
          <JoinStep
            onSetSpinal={stepHandlers.setSpinal}
            onBack={goBack}
          />
        );
        break;

      case 'nonmember':
        stepComponent = (
          <NonMemberStep
            onProceed={() => goTo('treatments')}
            onSchedule={() => console.log('Schedule future treatment')}
            onBack={goBack}
          />
        );
        break;

      case 'treatments':
        stepComponent = (
          <TreatmentsStep
            onSelect={stepHandlers.selectTreatment}
            onBack={goBack}
          />
        );
        break;

      case 'details':
        stepComponent = (
          <DetailsStep
            details={state.details}
            onUpdateField={stepHandlers.updateField}
            onSubmit={handleSubmit}
            onBack={goBack}
            submitAttempted={state.submitAttempted}
            dispatch={dispatch}
            isSubmitting={state.isSubmitting}
            submissionError={state.submissionError}
          />
        );
        break;

      case 'success':
        stepComponent = <SuccessStep />;
        break;

      default:
        return null;
    }

    return (
      <motion.div
        key={state.step}
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {stepComponent}
      </motion.div>
    );
  };

  return (
    <div className={className}>
      <ResponsiveCard className="mb-4 space-y-6">
        <BodyText size="lg" className="font-medium text-white">
          {locationInfo.customLocation}
        </BodyText>
        <BodyText size="lg" className="font-medium text-white">
          Hours: {locationInfo.customHours}
        </BodyText>
      </ResponsiveCard>

      <ResponsiveCard className="overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          {renderStep()}
        </AnimatePresence>
      </ResponsiveCard>
    </div>
  );
}
