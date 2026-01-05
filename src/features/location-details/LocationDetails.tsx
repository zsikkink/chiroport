'use client';

import { useReducer, useEffect } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import 'react-phone-number-input/style.css';
import { BodyText, ResponsiveCard } from '@/components/ui';
import { FormSubmissionData } from '@/types/waitwhile';
import { submitWaitwhileForm } from '@/lib';
import { detailsSchemaFactory } from '@/schemas/intake';
import type { LocationDetailsProps, Step } from '@/features/location-details/types';
import type { IntakeCategory } from '@/data/waitwhileData';
import { FLOW_CONFIG, FLOW_TRANSITIONS, TREATMENTS } from '@/features/location-details/config';
import { createWizardInitialState, wizardReducer } from '@/features/location-details/reducer';
import {
  CategoryStep,
  DetailsStep,
  JoinStep,
  MassageOptionsStep,
  MembershipStep,
  NonMemberStep,
  SuccessStep,
} from '@/features/location-details/components/steps';

// Define the expected API response structure
interface SubmissionResponse {
  visitId: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
}

// ============================================================================
// DATA & TYPES
// ============================================================================


// ============================================================================
// VALIDATION
// ============================================================================


const createDetailsSchema = detailsSchemaFactory;

const UNDECIDED_TREATMENT = TREATMENTS.find(
  (treatment) => treatment.title === 'Undecided'
);

// ============================================================================
// ANIMATION
// ============================================================================

const fadeVariants = {
  initial: {
    opacity: 0
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.6, ease: cubicBezier(0.4, 0.0, 0.2, 1) }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.6, ease: cubicBezier(0.4, 0.0, 0.2, 1) }
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LocationDetails({
  locationInfo,
  className = '',
}: LocationDetailsProps) {
  const intakeCategory: IntakeCategory = locationInfo.intakeCategory ?? 'standard';
  const flowConfig = FLOW_CONFIG[intakeCategory];
  const flowTransitions = FLOW_TRANSITIONS[intakeCategory];
  const [state, dispatch] = useReducer(
    wizardReducer,
    flowConfig.initialStep,
    (initialStep: Step) => createWizardInitialState(initialStep)
  );
  // Consent text rules:
  // - Priority Pass / Lounge Key members use the "bodywork" consent (even in the standard flow,
  //   where `visitCategory` is never set).
  // - Massage visitors use the same "bodywork" consent.
  // - Chiropractor visitors use chiropractic consent.
  const isBodyworkVisitor =
    state.isMember === true ||
    state.visitCategory === 'massage' ||
    state.visitCategory === 'priority_pass';
  const showEmailField = true;
  const requireEmail = true;
  const consentSuffix = (
    <>
      {' '}I agree to the{' '}
      <a className="underline text-white hover:text-white/80" href="/privacy-policy">
        Privacy Policy
      </a>{' '}
      and{' '}
      <a className="underline text-white hover:text-white/80" href="/terms-and-conditions">
        Terms &amp; Conditions
      </a>
      .
    </>
  );
  const consentLabel = isBodyworkVisitor ? (
    <>
      I consent to bodywork services from The Chiroport and release The Chiroport and its
      providers from liability for normal reactions except in cases of negligence. I
      agree to receive SMS updates about my visit. Msg & data rates may apply. Reply
      STOP to unsubscribe. Reply HELP for help.
      {consentSuffix}
    </>
  ) : (
    <>
      I consent to receiving chiropractic care from The Chiroport. I understand that
      chiropractic adjustments are generally safe and effective, and I release The
      Chiroport and its providers from any liability for injuries or effects except
      those caused by gross negligence. I agree to receive SMS updates about my visit.
      Msg & data rates may apply. Reply STOP to unsubscribe. Reply HELP for help.
      {consentSuffix}
    </>
  );
  const uiOverrides = locationInfo.uiOverrides;
  const massageCategoryLabel = uiOverrides?.massageCategoryLabel ?? 'Massage';
  const massageOptionsTitle = uiOverrides?.massageOptionsTitle ?? massageCategoryLabel;
  const joinServiceSummary =
    uiOverrides?.joinServiceSummary ?? 'Service includes stretching, muscle work, and massage.';

  const selectUndecidedTreatment = () => {
    if (!UNDECIDED_TREATMENT) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Undecided treatment option not found in TREATMENTS list.');
      }
      return;
    }
    dispatch({ type: 'SELECT_TREATMENT', treatment: UNDECIDED_TREATMENT });
  };

  // Scroll to top when navigating between service menu and details
  useEffect(() => {
    if (state.step === 'details' || state.step === 'massage_options') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.step]);

  useEffect(() => {
    dispatch({ type: 'RESET', step: flowConfig.initialStep });
  }, [locationInfo.waitwhileLocationId, flowConfig.initialStep]);

  const goTo = (step: Step) => {
    if (!flowConfig.steps.includes(step)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Attempted to navigate to unsupported step "${step}" for intake category "${intakeCategory}".`);
      }
      return;
    }
    dispatch({ type: 'GO_TO', step });
  };
  const goBack = () => dispatch({ type: 'GO_BACK' });

  const handleSubmit = async () => {
    dispatch({ type: 'ATTEMPT_SUBMIT' });
    
    const validationPayload = {
      name: state.details.name,
      phone: state.details.phone,
      email: state.details.email,
      consent: state.details.consent,
    };

    const validation = createDetailsSchema({
      requireEmail,
    }).safeParse(validationPayload);
    if (!validation.success) {
      return; // Form validation failed, errors will be shown
    }

    // Start submission
    dispatch({ type: 'SUBMIT_START' });

    try {
      // Prepare form data for API (no serviceId needed anymore)
      const formData: FormSubmissionData = {
        name: validationPayload.name,
        phone: validationPayload.phone,
        email: validationPayload.email,
        consent: validationPayload.consent,
        selectedTreatment: state.selectedTreatment,
        spinalAdjustment: state.spinalAdjustment,
        locationId: locationInfo.waitwhileLocationId
      };

      // Submit using secure API client with automatic CSRF handling
      const result = await submitWaitwhileForm<SubmissionResponse>(formData);

      if (!result.success) {
        throw new Error(result.error || result.message || 'Submission failed');
      }

      // Success - updated to match new API response structure
      const responseData = result.data as SubmissionResponse;
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

  const renderStandardFlowStep = () => {
    switch (state.step) {
      case 'question':
        return (
          <motion.div
            key={state.step}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <MembershipStep
              onYes={() => {
                dispatch({ type: 'SET_MEMBER', value: true });
                goTo(flowTransitions.afterMemberYes ?? 'join');
              }}
              onNo={() => {
                dispatch({ type: 'SET_MEMBER', value: false });
                selectUndecidedTreatment();
                goTo(flowTransitions.afterMemberNo ?? 'details');
              }}
            />
          </motion.div>
        );

      case 'join':
        return (
          <motion.div
            key={state.step}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <JoinStep
              onSetSpinal={(value) => {
                dispatch({ type: 'SET_SPINAL', value });
                goTo(flowTransitions.afterSpinalDecision ?? 'details');
              }}
              onBack={goBack}
              serviceSummary={joinServiceSummary}
            />
          </motion.div>
        );

      case 'nonmember':
        return (
          <motion.div
            key={state.step}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <NonMemberStep
              onProceed={() => {
                selectUndecidedTreatment();
                goTo('details');
              }}
              onSchedule={() => console.log('Schedule future treatment')}
              onBack={goBack}
            />
          </motion.div>
        );

      case 'details':
        return (
          <motion.div
            key={state.step}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <DetailsStep
              details={state.details}
              onUpdateField={(field, value) => dispatch({ type: 'UPDATE_FIELD', field, value })}
              onSubmit={handleSubmit}
              onBack={goBack}
              submitAttempted={state.submitAttempted}
              onDismissError={() => dispatch({ type: 'SUBMIT_ERROR', error: '' })}
              isSubmitting={state.isSubmitting}
              submissionError={state.submissionError}
              requireEmail={requireEmail}
              consentLabel={consentLabel}
              showEmailField={showEmailField}
            />
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            key={state.step}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SuccessStep />
          </motion.div>
        );

      default:
        return null;
    }
  };

  const renderOffersMassageFlowStep = () => {
    if (state.step === 'category') {
      return (
        <motion.div
          key={state.step}
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <CategoryStep
            selectedCategory={state.visitCategory}
            massageLabel={massageCategoryLabel}
            onSelect={(category) => {
              dispatch({ type: 'SET_VISIT_CATEGORY', value: category });
              dispatch({ type: 'SET_MEMBER', value: category === 'priority_pass' });
              dispatch({ type: 'DESELECT_SPINAL' });
              dispatch({ type: 'CLEAR_SELECTED_TREATMENT' });

              const categoryTransitions = flowTransitions.category;
              if (!categoryTransitions) {
                if (process.env.NODE_ENV !== 'production') {
                  console.warn(`No category transitions configured for intake category "${intakeCategory}".`);
                }
                return;
              }

              if (category === 'priority_pass') {
                goTo(categoryTransitions.priority_pass);
              } else if (category === 'chiropractor') {
                selectUndecidedTreatment();
                goTo(categoryTransitions.chiropractor);
              } else {
                goTo(categoryTransitions.massage);
              }
            }}
          />
        </motion.div>
      );
    }

    if (state.step === 'massage_options') {
      return (
        <motion.div
          key={state.step}
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <MassageOptionsStep
            selectedTreatment={state.selectedTreatment}
            title={massageOptionsTitle}
            onSelect={(treatment) => {
              dispatch({ type: 'SELECT_TREATMENT', treatment });
              const nextStep = flowTransitions.afterTreatmentSelection ?? 'details';
              goTo(nextStep);
            }}
            onBack={goBack}
          />
        </motion.div>
      );
    }

    return renderStandardFlowStep();
  };

  const renderStep = () =>
    intakeCategory === 'offers_massage'
      ? renderOffersMassageFlowStep()
      : renderStandardFlowStep();

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
