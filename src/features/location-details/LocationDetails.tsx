'use client';

import { useEffect, useLayoutEffect, useReducer } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion, cubicBezier } from 'framer-motion';
import 'react-phone-number-input/style.css';
import { BodyText, ResponsiveCard } from '@/components/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { detailsSchemaFactory } from '@/schemas/intake';
import type { LocationDetailsProps, Step, VisitCategory } from '@/features/location-details/types';
import type { IntakeCategory } from '@/data/locationData';
import { MASSAGE_OPTIONS, TREATMENTS } from '@/features/location-details/config';
import { createWizardInitialState, wizardReducer } from '@/features/location-details/reducer';
import { ConsentField, InputField, PhoneField } from '@/features/location-details/components/fields';
import { SuccessStep } from '@/features/location-details/components/steps';

interface SubmissionResponse {
  queueEntryId: string;
  publicToken: string;
  queueId: string;
  status: string;
  createdAt: string;
  queuePosition?: number;
  alreadyInQueue?: boolean;
}

const createDetailsSchema = detailsSchemaFactory;

const UNDECIDED_TREATMENT = TREATMENTS.find(
  (treatment) => treatment.title === 'Undecided'
);

const sectionLabelClass = 'text-left text-lg font-bold text-black';

const selectionButtonClass = `
  w-full rounded-xl border px-4 py-3 text-lg font-semibold
  appearance-none select-none touch-manipulation
  [-webkit-tap-highlight-color:transparent]
  text-slate-900
  bg-white border-slate-300/90
  transition-colors duration-100
  hover:bg-slate-100 active:bg-sky-100
  focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200
  !shadow-none !ring-0 hover:!shadow-none active:!shadow-none
  hover:!translate-y-0 active:!translate-y-0
`;

const selectedSelectionButtonClass = `
  bg-sky-200 border-sky-400 text-slate-900
  hover:bg-sky-200 active:bg-sky-200
`;

const selectedSelectionButtonStyle: CSSProperties = {
  backgroundColor: 'rgb(186 230 253)',
  borderColor: 'rgb(56 189 248)',
  color: 'rgb(15 23 42)',
};

const popInTransition = {
  initial: { opacity: 0, y: 8, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: cubicBezier(0.2, 0.8, 0.2, 1) },
  },
  exit: {
    opacity: 0,
    y: 6,
    scale: 0.99,
    transition: { duration: 0.18, ease: cubicBezier(0.2, 0.8, 0.2, 1) },
  },
};

interface SelectionButtonProps {
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

function SelectionButton({ label, selected, onClick, className = '' }: SelectionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={selected ? selectedSelectionButtonStyle : undefined}
      className={`${selectionButtonClass} ${selected ? selectedSelectionButtonClass : ''} ${className}`}
    >
      {label}
    </button>
  );
}

export default function LocationDetails({
  locationInfo,
  airportCode,
  locationCode,
  className = '',
}: LocationDetailsProps) {
  const supabase = getSupabaseBrowserClient();
  const intakeCategory: IntakeCategory = locationInfo.intakeCategory ?? 'standard';
  const isOffersMassage = intakeCategory === 'offers_massage';
  const initialStep: Step = isOffersMassage ? 'category' : 'question';
  const [state, dispatch] = useReducer(
    wizardReducer,
    initialStep,
    (startStep: Step) => createWizardInitialState(startStep)
  );

  const isBodyworkVisitor =
    state.isMember === true ||
    state.visitCategory === 'massage' ||
    state.visitCategory === 'priority_pass';

  const showEmailField = true;
  const requireEmail = true;

  const consentSuffix = (
    <>
      {' '}I agree to the{' '}
      <a className="underline text-blue-600 hover:text-blue-700" href="/privacy-policy">
        Privacy Policy
      </a>{' '}
      and{' '}
      <a className="underline text-blue-600 hover:text-blue-700" href="/terms-and-conditions">
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
  const massageOptionsTitle = uiOverrides?.massageOptionsTitle ?? 'Select length';
  const joinServiceSummary =
    uiOverrides?.joinServiceSummary ?? 'Service includes stretching, muscle work, and massage.';

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const rafId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [airportCode, locationCode]);

  useEffect(() => {
    dispatch({ type: 'RESET', step: initialStep });
  }, [airportCode, locationCode, initialStep]);

  const selectUndecidedTreatment = () => {
    if (!UNDECIDED_TREATMENT) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Undecided treatment option not found in TREATMENTS list.');
      }
      return;
    }
    dispatch({ type: 'SELECT_TREATMENT', treatment: UNDECIDED_TREATMENT });
  };

  const handleCategorySelect = (category: VisitCategory) => {
    if (!category) return;

    dispatch({ type: 'SET_VISIT_CATEGORY', value: category });
    dispatch({ type: 'SET_MEMBER', value: category === 'priority_pass' });
    dispatch({ type: 'DESELECT_SPINAL' });

    if (category === 'massage') {
      dispatch({ type: 'CLEAR_SELECTED_TREATMENT' });
      return;
    }

    if (category === 'chiropractor') {
      selectUndecidedTreatment();
      return;
    }

    dispatch({ type: 'CLEAR_SELECTED_TREATMENT' });
  };

  const handleMembershipAnswer = (value: boolean) => {
    dispatch({ type: 'SET_MEMBER', value });
    if (!value) {
      dispatch({ type: 'DESELECT_SPINAL' });
    }
  };

  const showUpsellQuestion = isOffersMassage
    ? state.visitCategory === 'priority_pass'
    : state.isMember === true;

  const showMassageOptions = isOffersMassage && state.visitCategory === 'massage';

  const missingFlowRequirement = (() => {
    if (isOffersMassage) {
      if (!state.visitCategory) {
        return 'Select a category before joining the queue.';
      }

      if (showUpsellQuestion && state.spinalAdjustment === null) {
        return 'Answer the add-on question before joining the queue.';
      }

      if (showMassageOptions && !state.selectedTreatment) {
        return 'Select a massage option before joining the queue.';
      }

      return null;
    }

    if (state.isMember === null) {
      return 'Answer the membership question before joining the queue.';
    }

    if (showUpsellQuestion && state.spinalAdjustment === null) {
      return 'Answer the add-on question before joining the queue.';
    }

    return null;
  })();

  const validationPayload = {
    name: state.details.name,
    phone: state.details.phone,
    email: state.details.email,
    consent: state.details.consent,
  };

  const fieldValidation = createDetailsSchema({
    requireEmail,
  }).safeParse(validationPayload);

  const fieldErrors: { [key: string]: string[] } = fieldValidation.success
    ? {}
    : fieldValidation.error.formErrors.fieldErrors;

  const visibleSubmissionError =
    state.submissionError && state.submissionError.trim().length > 0
      ? state.submissionError
      : null;

  const handleSubmit = async () => {
    dispatch({ type: 'ATTEMPT_SUBMIT' });

    const validation = createDetailsSchema({
      requireEmail,
    }).safeParse(validationPayload);

    if (!validation.success || missingFlowRequirement) {
      return;
    }

    dispatch({ type: 'SUBMIT_START' });

    try {
      const isPriorityPass =
        state.visitCategory === 'priority_pass' || state.isMember === true;
      const wantsAdjustments = isPriorityPass && state.spinalAdjustment === true;
      const effectiveCustomerType = wantsAdjustments
        ? 'paying'
        : isPriorityPass
          ? 'priority_pass'
          : 'paying';

      const massageSelection = state.selectedTreatment?.title?.trim();
      const massageLabel = massageSelection
        ? `Massage: ${massageSelection.toLowerCase()}`
        : 'Massage';

      const serviceLabel = wantsAdjustments
        ? 'Priority Pass + Adjustments'
        : isPriorityPass
          ? 'Priority Pass'
          : intakeCategory === 'offers_massage'
            ? state.visitCategory === 'chiropractor'
              ? 'Chiropractor'
              : state.visitCategory === 'massage'
                ? massageLabel
                : 'Paying'
            : 'Paying';

      const consentKey = isBodyworkVisitor
        ? 'queue_join_consent_bodywork'
        : 'queue_join_consent_chiropractic';

      const { data, error } = await supabase.functions.invoke('queue_join', {
        body: {
          airportCode,
          locationCode,
          name: validationPayload.name,
          phone: validationPayload.phone,
          email: validationPayload.email,
          consent: validationPayload.consent,
          customerType: effectiveCustomerType,
          serviceLabel,
          consentKey,
        },
      });

      if (error) {
        let message = error.message || 'Submission failed';
        const context = (error as { context?: Response }).context;

        if (context) {
          try {
            const raw = await context.text();
            if (raw) {
              try {
                const parsedError = JSON.parse(raw);
                message = parsedError?.error || message;
              } catch {
                message = raw;
              }
            }
          } catch {
            // Ignore response parsing failures.
          }
        }

        throw new Error(message);
      }

      if (!data || data.error) {
        throw new Error(data?.error || 'Submission failed');
      }

      let responseData: SubmissionResponse;
      if (typeof data === 'string') {
        try {
          responseData = JSON.parse(data) as SubmissionResponse;
        } catch {
          throw new Error('Invalid response from queue service. Please try again.');
        }
      } else {
        responseData = data as SubmissionResponse;
      }

      const { data: visitData, error: visitError } = await supabase.rpc('get_visit', {
        p_public_token: responseData.publicToken,
      });

      if (visitError || !visitData?.length) {
        throw new Error('Unable to confirm your place in line. Please try again.');
      }

      dispatch({
        type: 'SUBMIT_SUCCESS',
        payload: {
          queueEntryId: responseData.queueEntryId,
          publicToken: responseData.publicToken,
          ...(effectiveCustomerType === 'paying'
            ? { queuePosition: responseData.queuePosition }
            : {}),
          alreadyInQueue: responseData.alreadyInQueue ?? false,
        },
      });
    } catch (error) {
      dispatch({
        type: 'SUBMIT_ERROR',
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  if (state.submissionSuccess) {
    return (
      <div className={className}>
        <ResponsiveCard className="overflow-hidden">
          <SuccessStep submissionSuccess={state.submissionSuccess} />
        </ResponsiveCard>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveCard className="overflow-hidden [&_button]:!shadow-none [&_button:hover]:!shadow-none [&_button:active]:!shadow-none [&_button:hover]:!translate-y-0 [&_button:active]:!translate-y-0 [&_button]:[-webkit-tap-highlight-color:transparent]">
        <div className="space-y-8 py-4">
          <section className="space-y-4">
            {isOffersMassage ? (
              <div className="space-y-3">
                <p className="text-left text-lg font-bold text-black">
                  Select category <span className="text-red-600">*</span>
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <SelectionButton
                    onClick={() => handleCategorySelect('priority_pass')}
                    selected={state.visitCategory === 'priority_pass'}
                    label="Priority Pass / Lounge Key"
                    className="min-h-[4.25rem] leading-snug"
                  />
                  <SelectionButton
                    onClick={() => handleCategorySelect('chiropractor')}
                    selected={state.visitCategory === 'chiropractor'}
                    label="Chiropractor"
                    className="min-h-[4.25rem]"
                  />
                  <SelectionButton
                    onClick={() => handleCategorySelect('massage')}
                    selected={state.visitCategory === 'massage'}
                    label={massageCategoryLabel}
                    className="min-h-[4.25rem]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <BodyText size="lg" className="text-black font-extrabold">
                  Priority Pass or Lounge Key member? <span className="text-red-600">*</span>
                </BodyText>
                <div className="grid grid-cols-2 gap-3">
                  <SelectionButton
                    onClick={() => handleMembershipAnswer(true)}
                    selected={state.isMember === true}
                    label="Yes"
                  />
                  <SelectionButton
                    onClick={() => handleMembershipAnswer(false)}
                    selected={state.isMember === false}
                    label="No"
                  />
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {showUpsellQuestion ? (
                <motion.div
                  key="upsell-question"
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={popInTransition}
                  className="my-3 sm:my-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <BodyText size="lg" className="text-black font-bold">
                    {joinServiceSummary}
                  </BodyText>
                  <BodyText size="lg" className="text-black font-bold">
                    Would you like to add spinal &amp; neck adjustments for only $35 - a 50% discount?{' '}
                    <span className="text-red-600">*</span>
                  </BodyText>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectionButton
                      onClick={() => dispatch({ type: 'SET_SPINAL', value: true })}
                      selected={state.spinalAdjustment === true}
                      label="Yes"
                    />
                    <SelectionButton
                      onClick={() => dispatch({ type: 'SET_SPINAL', value: false })}
                      selected={state.spinalAdjustment === false}
                      label="No"
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {showMassageOptions ? (
                <motion.div
                  key="massage-options"
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={popInTransition}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <p className={sectionLabelClass}>
                    {massageOptionsTitle} <span className="text-red-600">*</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {MASSAGE_OPTIONS.map((option) => (
                      <SelectionButton
                        key={option.title}
                        onClick={() => dispatch({ type: 'SELECT_TREATMENT', treatment: option })}
                        selected={state.selectedTreatment?.title === option.title}
                        label={
                          <span className="w-full text-center font-bold text-lg leading-snug">
                            <span>{option.title}</span>{' '}
                            <span className="font-normal">{option.price}</span>
                          </span>
                        }
                        className="min-h-[4.25rem]"
                      />
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          <section className="space-y-4 pt-3 sm:pt-4">
            {visibleSubmissionError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <BodyText size="lg" className="text-red-700">
                  ❌ {visibleSubmissionError}
                </BodyText>
                <button
                  onClick={() => dispatch({ type: 'SUBMIT_ERROR', error: '' })}
                  className="
                    mt-3 px-3 py-1.5 text-lg font-semibold
                    bg-[var(--color-header)] text-white
                    border border-[color:var(--color-body)]
                    rounded-md
                    hover:bg-[var(--color-primary-dark)]
                    transition-colors duration-200
                  "
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            <InputField
              label="Name"
              value={state.details.name}
              onChange={(value) => dispatch({ type: 'UPDATE_FIELD', field: 'name', value })}
              placeholder="Full name"
              {...(state.submitAttempted && fieldErrors.name?.[0] ? { error: fieldErrors.name[0] } : {})}
              required
            />

            <PhoneField
              details={state.details}
              onUpdateField={(field, value) => dispatch({ type: 'UPDATE_FIELD', field, value })}
              submitAttempted={state.submitAttempted}
              errors={fieldErrors}
            />

            {showEmailField ? (
              <InputField
                label="Email Address"
                type="email"
                value={state.details.email}
                onChange={(value) => dispatch({ type: 'UPDATE_FIELD', field: 'email', value })}
                placeholder="Email address"
                {...(state.submitAttempted && fieldErrors.email?.[0] ? { error: fieldErrors.email[0] } : {})}
                required={requireEmail}
              />
            ) : null}

            <ConsentField
              details={state.details}
              onUpdateField={(field, value) => dispatch({ type: 'UPDATE_FIELD', field, value })}
              submitAttempted={state.submitAttempted}
              errors={fieldErrors}
              label={consentLabel}
            />

            {state.submitAttempted && missingFlowRequirement ? (
              <p className="text-lg font-medium text-red-600">
                {missingFlowRequirement}
              </p>
            ) : null}

            <div className="mt-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={state.isSubmitting}
                className="
                  w-full rounded-xl border border-transparent px-5 py-4 text-lg font-semibold
                  bg-[var(--color-header)] text-white
                  transition-colors duration-150
                  hover:bg-[var(--color-primary-dark)]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200
                  disabled:cursor-not-allowed disabled:opacity-60
                  !shadow-none !ring-0 hover:!shadow-none active:!shadow-none
                  hover:!translate-y-0 active:!translate-y-0
                  [-webkit-tap-highlight-color:transparent]
                "
              >
                {state.isSubmitting ? 'Joining Queue...' : 'Join Queue'}
              </button>
            </div>
          </section>
        </div>
      </ResponsiveCard>
    </div>
  );
}
