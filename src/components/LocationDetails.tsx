'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import 'react-phone-number-input/style.css';

import ResponsiveCard from './ResponsiveCard';
import { BodyText } from './Typography';
import { LocationInfo } from '@/utils/locationData';

import { submitFormSecurely, formSubmissionLimiter } from '@/utils/client-api';
import { TREATMENTS } from '@/constants/treatments';
import { 
  Step, 
  Treatment, 
  WizardState, 
  WizardAction, 
  SubmissionResponse 
} from '@/types/wizard';
import { detailsSchema } from '@/validation/detailsSchema';
import { useWizard } from '@/hooks/useWizard';
import { fadeVariants } from '@/ui/animation/fadeVariants';
import { 
  AnimatedButton, 
  BackButton, 
  InputField, 
  PhoneField, 
  BirthdayField, 
  DiscomfortField, 
  ConsentField, 
  TextAreaField, 
  YesNoButtons 
} from '@/ui/atoms';

// ============================================================================
// DATA & TYPES
// ============================================================================

// Types now imported from @/types/wizard

// ============================================================================
// VALIDATION
// ============================================================================
// Schema now imported from @/validation/detailsSchema

// ============================================================================
// REDUCER
// ============================================================================
// Reducer logic now in @/hooks/useWizard

// ============================================================================
// ANIMATION
// ============================================================================
// Animation variants now imported from @/ui/animation/fadeVariants

// ============================================================================
// ANIMATED BUTTON COMPONENT
// ============================================================================
// AnimatedButton now imported from @/ui/atoms

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================
// All UI components now imported from @/ui/atoms

// All field components now imported from @/ui/atoms

// ============================================================================
// STEP COMPONENTS
// ============================================================================

const MembershipStep = ({ onYes, onNo }: { onYes: () => void; onNo: () => void }) => (
  <div className="space-y-4 py-4">
    <BodyText size="2xl" className="font-medium text-white">
      Priority Pass or Lounge Key member?
    </BodyText>
    <YesNoButtons onYes={onYes} onNo={onNo} selected={null} />
  </div>
);

const JoinStep = ({ 
  onSetSpinal, 
  onBack
}: { 
  onSetSpinal: (value: boolean) => void;
  onBack: () => void;
}) => (
  <div className="py-4">
    <BackButton onClick={onBack} />
    <BodyText size="2xl" className="font-medium text-white mt-4">
      The Priority Pass & Lounge Key service includes stretching, muscle work, and massage.
    </BodyText>
    <div className="space-y-3 mt-12">
      <BodyText size="2xl" className="text-white">
      Would you like to add spinal & neck adjustments for just $35  — a 50% Discount!
      </BodyText>
      <div className="flex gap-4">
        <AnimatedButton onClick={() => onSetSpinal(true)}>
          Yes
        </AnimatedButton>
        <AnimatedButton onClick={() => onSetSpinal(false)}>
          No
        </AnimatedButton>
      </div>
    </div>
  </div>
);

const NonMemberStep = ({ 
  onProceed, 
  onSchedule, 
  onBack 
}: { 
  onProceed: () => void;
  onSchedule: () => void;
  onBack: () => void;
}) => (
  <div className="space-y-4 py-4">
    <BackButton onClick={onBack} />
    <AnimatedButton onClick={onProceed}>
      Join Queue
    </AnimatedButton>
    <AnimatedButton onClick={onSchedule}>
      Schedule a Future Treatment
    </AnimatedButton>
  </div>
);

const TreatmentsStep = ({ 
  onSelect, 
  onBack 
}: { 
  onSelect: (treatment: Treatment) => void;
  onBack: () => void;
}) => (
  <div className="space-y-4 py-4">
    <div className="relative flex items-center mb-6">
      <BackButton onClick={onBack} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <BodyText size="3xl" className="font-bold text-white text-center">Select Service</BodyText>
      </div>
    </div>
    <div className="space-y-3">
      {TREATMENTS.map((treatment) => (
        <AnimatedButton 
          key={treatment.title}
          onClick={() => onSelect(treatment)}
          className="!text-left !items-start !justify-start"
        >
          <div className="w-full text-left">
            <h3 className="font-bold text-lg mb-1">{treatment.title}</h3>
            {treatment.price && treatment.time && (
              <div className="text-sm font-bold mb-2">
                {treatment.price} • {treatment.time}
              </div>
            )}
            <p className="text-base leading-relaxed">{treatment.description}</p>
          </div>
        </AnimatedButton>
      ))}
    </div>
  </div>
);

const DetailsStep = ({ 
  details, 
  onUpdateField, 
  onSubmit, 
  onBack, 
  submitAttempted,
  dispatch,
  isSubmitting,
  submissionError
}: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string | boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitAttempted: boolean;
  dispatch: (action: WizardAction) => void;
  isSubmitting: boolean;
  submissionError: string | null;
}) => {
  const validation = detailsSchema.safeParse(details);
  const errors = validation.success ? {} : validation.error.formErrors.fieldErrors;

  return (
    <div className="space-y-4 py-4">
      <div className="relative flex items-center mb-6">
        <BackButton onClick={onBack} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <BodyText size="3xl" className="font-bold text-white text-center">Enter your details</BodyText>
        </div>
      </div>

      {submissionError && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
          <BodyText size="base" className="text-white">
            ❌ {submissionError}
          </BodyText>
          <button
            onClick={() => dispatch({ type: 'SUBMIT_ERROR', error: '' })}
            className="text-white/80 text-sm mt-2 underline hover:text-white hover:bg-white/10 px-2 py-1 rounded transition-all duration-200"
          >
            Dismiss
          </button>
        </div>
      )}

      <InputField
        label="Name"
        value={details.name}
        onChange={(value) => onUpdateField('name', value)}
        placeholder="Full name"
        {...(submitAttempted && errors.name?.[0] ? { error: errors.name[0] } : {})}
        required
      />

      <PhoneField
        details={details}
        onUpdateField={(field, value) => onUpdateField(field, value as string)}
        submitAttempted={submitAttempted}
        errors={errors}
      />

      <InputField
        label="Email Address"
        type="email"
        value={details.email}
        onChange={(value) => onUpdateField('email', value)}
        placeholder="Email address"
        {...(submitAttempted && errors.email?.[0] ? { error: errors.email[0] } : {})}
        required
      />

      <BirthdayField
        details={details}
        onUpdateField={(field, value) => onUpdateField(field, value as string)}
        submitAttempted={submitAttempted}
        errors={errors}
      />

      <DiscomfortField
        details={details}
        onUpdateDiscomfort={(values) => dispatch({ type: 'UPDATE_DISCOMFORT', values })}
        submitAttempted={submitAttempted}
        errors={errors}
      />

      <TextAreaField
        label="Is there anything else you would like the chiropractor to know? (Optional)"
        value={details.additionalInfo}
        onChange={(value) => onUpdateField('additionalInfo', value)}
        placeholder="Add any additional information"
        {...(submitAttempted && errors.additionalInfo?.[0] ? { error: errors.additionalInfo[0] } : {})}
        required={false}
      />

      <ConsentField
        details={details}
        onUpdateField={(field, value) => onUpdateField(field, value as boolean)}
        submitAttempted={submitAttempted}
        errors={errors}
      />

      <div className="mt-6">
        <AnimatedButton 
          onClick={onSubmit} 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Joining Queue...' : 'Join Queue'}
        </AnimatedButton>
      </div>
    </div>
  );
};

const SuccessStep = () => (
  <div className="space-y-6 py-4 text-center">
    <div className="mb-6">
      <BodyText size="3xl" className="font-bold text-white mb-4">🎉 You&apos;re in the queue! 🎉</BodyText>
      
    </div>

    <div className="space-y-4">
      <BodyText size="lg" className="text-white">
        We&apos;ll text you when you&apos;re up next.
      </BodyText>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

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

  const handleSubmit = async () => {
    dispatch({ type: 'ATTEMPT_SUBMIT' });
    
    const validation = detailsSchema.safeParse(state.details);
    if (!validation.success) {
      return; // Form validation failed, errors will be shown
    }

    // Start submission
    dispatch({ type: 'SUBMIT_START' });

    try {
      // Apply client-side rate limiting
      await formSubmissionLimiter.throttle();

      // Prepare form data for API (no serviceId needed anymore)
      const formData = {
        name: state.details.name,
        phone: state.details.phone,
        email: state.details.email,
        birthday: state.details.birthday,
        discomfort: state.details.discomfort,
        additionalInfo: state.details.additionalInfo,
        consent: state.details.consent,
        selectedTreatment: state.selectedTreatment,
        spinalAdjustment: state.spinalAdjustment,
        locationId: locationInfo.waitwhileLocationId
      };

      // Submit using secure API client with automatic CSRF handling
      const result = await submitFormSecurely<SubmissionResponse>(formData);

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

  const renderStep = () => {
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
                goTo('join');
              }}
              onNo={() => {
                dispatch({ type: 'SET_MEMBER', value: false });
                goTo('treatments');
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
                goTo('details');
              }}
              onBack={goBack}
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
              onProceed={() => goTo('treatments')}
              onSchedule={() => console.log('Schedule future treatment')}
              onBack={goBack}
            />
          </motion.div>
        );

      case 'treatments':
        return (
          <motion.div
            key={state.step}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <TreatmentsStep
              onSelect={(treatment) => {
                dispatch({ type: 'SELECT_TREATMENT', treatment });
                goTo('details');
              }}
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
              dispatch={dispatch}
              isSubmitting={state.isSubmitting}
              submissionError={state.submissionError}
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
