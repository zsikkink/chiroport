'use client';

import { useReducer, useEffect } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import 'react-phone-number-input/style.css';
import ResponsiveCard from './ResponsiveCard';
import { BodyText } from './Typography';
import { FormSubmissionData } from '@/types/waitwhile';
import { AsYouType } from 'libphonenumber-js';
import { submitWaitwhileForm } from '@/utils/api-client';
import { detailsSchemaFactory } from '@/schemas/intake';
import type {
  LocationDetailsProps,
  Step,
  WizardState,
  TreatmentOption,
  VisitCategory,
} from '@/features/locationDetails/types';
import type { IntakeCategory } from '@/constants/waitwhile';
import {
  FLOW_CONFIG,
  FLOW_TRANSITIONS,
  MASSAGE_OPTIONS,
  TREATMENTS,
} from '@/features/locationDetails/config';
import { createWizardInitialState, wizardReducer } from '@/features/locationDetails/reducer';
import AnimatedButton from '@/features/locationDetails/components/AnimatedButton';
import BackButton from '@/features/locationDetails/components/BackButton';
import YesNoButtons from '@/features/locationDetails/components/YesNoButtons';

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

const LAS_VEGAS_LOCATION_IDS = new Set<string>([
  'kjAmNhyUygMlvVUje1gc', // LAS - Concourse B
  'BKncaAgwFhUrywvRCgXT', // LAS - Concourse C
]);

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
// ANIMATED BUTTON COMPONENT
// ============================================================================

const InputField = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  placeholder, 
  error,
  required = false
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  required?: boolean;
}) => (
  <div>
    <label className="block text-white text-base font-bold mb-2">
      {label} {required && '*'}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white text-black rounded-lg p-4 border-2 border-white focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500"
    />
    {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
  </div>
);

function PhoneField({ details, onUpdateField, submitAttempted, errors }: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string) => void;
  submitAttempted: boolean;
  errors: { [key: string]: string[] };
}) {
  const isIntl = details.phone?.startsWith('+');

  // Format US phone number as (XXX) XXX-XXXX
  const formatUSPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // helper to format international via AsYouType
  const intlDisplay = new AsYouType().input(details.phone || '');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // If user types '+' at the beginning, switch to international mode
    if (value.startsWith('+')) {
      let raw = value.replace(/[^\d+]/g, '');
      raw = raw.startsWith('+')
        ? '+' + raw.slice(1).replace(/\+/g, '')
        : raw.replace(/\+/g, '');
      onUpdateField('phone', raw);
    } else {
      // US formatting - extract only digits for storage
      const digitsOnly = value.replace(/\D/g, '');
      onUpdateField('phone', digitsOnly);
    }
  };

  return (
    <div>
      <label className="block text-white text-base font-bold mb-2">
        Phone Number *
      </label>

      {isIntl ? (
        // — international —
        <input
          type="tel"
          inputMode="tel"
          value={intlDisplay}
          onChange={handlePhoneChange}
          placeholder="+44 20 7123 4567"
          className="w-full bg-white text-black rounded-lg p-4 border-2 border-white focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500"
        />
      ) : (
        // — U.S. formatting —
        <input
          type="tel"
          value={formatUSPhone(details.phone || '')}
          onChange={handlePhoneChange}
          placeholder="Phone number"
          className="w-full bg-white text-black rounded-lg p-4 border-2 border-white focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500"
        />
      )}

      {submitAttempted && errors.phone && (
        <p className="text-red-400 text-sm mt-1">{errors.phone[0]}</p>
      )}
    </div>
  );
}

function ConsentField({ details, onUpdateField, submitAttempted, errors, label }: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: boolean) => void;
  submitAttempted: boolean;
  errors: { [key: string]: string[] };
  label: string;
}) {
  const isChecked = details.consent;

  return (
    <div>
      <label className="flex items-start cursor-pointer group">
        <div className="relative flex items-center mt-1">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onUpdateField('consent', e.target.checked)}
            className="sr-only"
          />
          <div className={`
            w-5 h-5 rounded border-2 border-white flex items-center justify-center transition-colors duration-200
            ${isChecked 
              ? 'bg-white' 
              : 'bg-transparent group-hover:bg-white/25'
            }
          `}>
            {isChecked && (
              <svg className="w-3 h-3 text-[#56655A]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
        <span className="ml-3 text-white text-base leading-relaxed">
          {label} *
        </span>
      </label>
      {submitAttempted && errors.consent && (
        <p className="text-red-400 text-sm mt-2">{errors.consent[0]}</p>
      )}
    </div>
  );
}

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
  onBack,
  serviceSummary,
}: { 
  onSetSpinal: (value: boolean) => void;
  onBack: () => void;
  serviceSummary: string;
}) => (
  <div className="py-4">
    <BackButton onClick={onBack} />
    <BodyText size="2xl" className="font-medium text-white mt-4">
      {serviceSummary}
    </BodyText>
    <div className="space-y-3 mt-8">
      <BodyText size="2xl" className="text-white">
      Would you like to add spinal & neck adjustments for only $35  — a 50% Discount!
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

const CategoryStep = ({ 
  selectedCategory,
  onSelect,
  massageLabel,
}: {
  selectedCategory: VisitCategory | null;
  onSelect: (category: VisitCategory) => void;
  massageLabel: string;
}) => (
  <div className="space-y-6 py-4">
    <BodyText size="3xl" className="font-bold text-white text-center">
      Select category
    </BodyText>
    <div className="space-y-3">
      <AnimatedButton
        onClick={() => onSelect('priority_pass')}
        selected={selectedCategory === 'priority_pass'}
        persistSelection={false}
      >
        Priority Pass / Lounge Key
      </AnimatedButton>
      <AnimatedButton
        onClick={() => onSelect('chiropractor')}
        selected={selectedCategory === 'chiropractor'}
        persistSelection={false}
      >
        Chiropractor
      </AnimatedButton>
      <AnimatedButton
        onClick={() => onSelect('massage')}
        selected={selectedCategory === 'massage'}
        persistSelection={false}
      >
        {massageLabel}
      </AnimatedButton>
    </div>
  </div>
);

const MassageOptionsStep = ({
  selectedTreatment,
  onSelect,
  onBack,
  title,
}: {
  selectedTreatment: TreatmentOption | null;
  onSelect: (treatment: TreatmentOption) => void;
  onBack: () => void;
  title: string;
}) => (
  <div className="space-y-6 py-4">
    <div className="relative flex items-center mb-4">
      <BackButton onClick={onBack} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <BodyText size="2xl" className="font-bold text-white text-center px-8">
          {title}
        </BodyText>
      </div>
    </div>
    <div className="space-y-3">
      {MASSAGE_OPTIONS.map((option) => (
        <AnimatedButton
          key={option.title}
          onClick={() => onSelect(option)}
          selected={selectedTreatment?.title === option.title}
          persistSelection={false}
        >
          <span className="w-full text-center font-bold">
            <span>{option.title}</span>{' '}
            <span className="font-normal">{option.price}</span>
          </span>
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
  onDismissError,
  isSubmitting,
  submissionError,
  requireEmail,
  consentLabel,
  showEmailField,
}: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string | boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitAttempted: boolean;
  onDismissError: () => void;
  isSubmitting: boolean;
  submissionError: string | null;
  requireEmail: boolean;
  consentLabel: string;
  showEmailField: boolean;
}) => {
  const validationPayload = {
    name: details.name,
    phone: details.phone,
    email: showEmailField ? details.email : undefined,
    consent: details.consent,
  };

  const validation = createDetailsSchema({
    requireEmail,
  }).safeParse(validationPayload);
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
            onClick={onDismissError}
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

      {showEmailField && (
        <InputField
          label="Email Address"
          type="email"
          value={details.email}
          onChange={(value) => onUpdateField('email', value)}
          placeholder="Email address"
          {...(submitAttempted && errors.email?.[0] ? { error: errors.email[0] } : {})}
          required={requireEmail}
        />
      )}

      <ConsentField
        details={details}
        onUpdateField={(field, value) => onUpdateField(field, value as boolean)}
        submitAttempted={submitAttempted}
        errors={errors}
        label={consentLabel}
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
      <BodyText size="xl" className="text-white">
        We&apos;ll text you when you&apos;re up next.
      </BodyText>
      <BodyText size="xl" className="text-white break-keep">
        If you enjoy your experience, a gratuity is greatly appreciated!
      </BodyText>
    </div>
  </div>
);

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
  const consentLabel = isBodyworkVisitor
  ? 'I consent to bodywork services from The Chiroport and release The Chiroport and its providers from liability for normal reactions except in cases of negligence. I agree to receive SMS updates about my visit. Msg & data rates may apply. Reply STOP to unsubscribe.'
  : 'I consent to receiving chiropractic care from The Chiroport. I understand that chiropractic adjustments are generally safe and effective, and I release The Chiroport and its providers from any liability for injuries or effects except those caused by gross negligence. I agree to receive SMS updates about my visit. Msg & data rates may apply. Reply STOP to unsubscribe.';
  const isLasVegasLocation = LAS_VEGAS_LOCATION_IDS.has(locationInfo.waitwhileLocationId);
  const massageCategoryLabel = isLasVegasLocation ? 'Massage Therapist' : 'Massage';
  const massageOptionsTitle = isLasVegasLocation ? 'Body Work' : massageCategoryLabel;
  const joinServiceSummary = isLasVegasLocation
    ? 'Service includes stretching, muscle work, and vibration massager.'
    : 'Service includes stretching, muscle work, and massage.';

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
