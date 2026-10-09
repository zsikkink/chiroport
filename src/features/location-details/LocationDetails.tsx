'use client';

import { useEffect, useLayoutEffect, useReducer } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion, cubicBezier } from 'framer-motion';
import { BodyText, ResponsiveCard } from '@/components/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { parseApiError, parseApiErrorText } from '@/lib/apiError';
import { detailsSchemaFactory } from '@/schemas/intake';
import type {
  LocationDetailsProps,
  ServiceChoice,
} from '@/features/location-details/types';
import type { IntakeCategory } from '@/data/locationData';
import { MASSAGE_OPTIONS } from '@/features/location-details/config';
import { OFFERING_CODES, type OfferingCode } from '@/domain/services/catalog';
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

const CANONICAL_OFFERING_CODES = new Set<OfferingCode>(
  Object.values(OFFERING_CODES)
);

function isCanonicalOfferingCode(
  choice: ServiceChoice | null
): choice is OfferingCode {
  return choice !== null && CANONICAL_OFFERING_CODES.has(choice as OfferingCode);
}

function isPriorityPassChoice(choice: ServiceChoice | null) {
  return (
    choice === 'priority_pass_pending' ||
    choice === OFFERING_CODES.PRIORITY_PASS ||
    choice === OFFERING_CODES.PRIORITY_PASS_ADJUSTMENTS
  );
}

function isMassageChoice(choice: ServiceChoice | null) {
  return choice === 'massage_pending' || choice?.startsWith('massage_') === true;
}

const sectionLabelClass = 'text-size-stable text-left text-[20px] leading-tight font-bold text-black';

const selectionButtonClass = `
  text-size-stable w-full rounded-xl border px-4 py-3 text-[20px] leading-tight font-bold
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
  ariaLabel?: string;
}

function SelectionButton({
  label,
  selected,
  onClick,
  className = '',
  ariaLabel,
}: SelectionButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
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
  const isMassageOnly = intakeCategory === 'massage_only';
  const [state, dispatch] = useReducer(
    wizardReducer,
    createWizardInitialState()
  );

  const showEmailField = true;
  const requireEmail = true;

  const consentLabel = (
    <>
      I agree to the{' '}
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

  const uiOverrides = locationInfo.uiOverrides;
  const massageCategoryLabel = uiOverrides?.massageCategoryLabel ?? 'Massage';
  const massageOptionsTitle = uiOverrides?.massageOptionsTitle ?? 'Choose duration';
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
    dispatch({ type: 'RESET' });
  }, [airportCode, locationCode]);

  const selectService = (value: ServiceChoice) => {
    dispatch({ type: 'SELECT_SERVICE', value });
  };

  const handleMembershipAnswer = (value: boolean) => {
    selectService(
      value ? 'priority_pass_pending' : OFFERING_CODES.CHIROPRACTIC
    );
  };

  const categoryOptions: Array<{
    category: 'priority_pass' | 'massage';
    label: string;
    className: string;
  }> = [
    {
      category: 'massage',
      label: massageCategoryLabel,
      className: 'min-h-[4.25rem]',
    },
    {
      category: 'priority_pass',
      label: 'Priority Pass / Lounge Key',
      className: 'min-h-[4.25rem] leading-snug',
    },
  ];

  const showUpsellQuestion =
    !isMassageOnly && isPriorityPassChoice(state.serviceChoice);
  const showMassageOptions =
    isMassageOnly && isMassageChoice(state.serviceChoice);

  const missingFlowRequirement = (() => {
    if (isMassageOnly) {
      if (!state.serviceChoice) {
        return 'Choose Massage or Priority Pass before joining the queue.';
      }

      if (state.serviceChoice === 'massage_pending') {
        return 'Select a massage option before joining the queue.';
      }

      return null;
    }

    if (state.serviceChoice === null) {
      return 'Answer the membership question before joining the queue.';
    }

    if (state.serviceChoice === 'priority_pass_pending') {
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
      if (!isCanonicalOfferingCode(state.serviceChoice)) {
        throw new Error('Select a service before joining the queue.');
      }
      const offeringCode = state.serviceChoice;

      const { data, error } = await supabase.functions.invoke('queue_join', {
        body: {
          airportCode,
          locationCode,
          name: validationPayload.name,
          phone: validationPayload.phone,
          email: validationPayload.email,
          consent: validationPayload.consent,
          offeringCode,
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
                message = parseApiErrorText(raw, message).message;
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
        throw new Error(parseApiError(data, 'Submission failed').message);
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

      dispatch({
        type: 'SUBMIT_SUCCESS',
        payload: {
          queueEntryId: responseData.queueEntryId,
          publicToken: responseData.publicToken,
          ...(offeringCode !== OFFERING_CODES.PRIORITY_PASS
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
          <SuccessStep
            submissionSuccess={state.submissionSuccess}
            isPriorityPass={state.serviceChoice === OFFERING_CODES.PRIORITY_PASS}
          />
        </ResponsiveCard>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveCard className="overflow-hidden [&_button]:!shadow-none [&_button:hover]:!shadow-none [&_button:active]:!shadow-none [&_button:hover]:!translate-y-0 [&_button:active]:!translate-y-0 [&_button]:[-webkit-tap-highlight-color:transparent]">
        <div className="space-y-8 py-4">
          <section className="space-y-4">
            {isMassageOnly ? (
              <div className="space-y-3">
                <p className={sectionLabelClass}>
                  Select category <span className="text-red-600">*</span>
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {categoryOptions.map((option) => (
                    <SelectionButton
                      key={option.category}
                      onClick={() =>
                        selectService(
                          option.category === 'massage'
                            ? 'massage_pending'
                            : OFFERING_CODES.PRIORITY_PASS
                        )
                      }
                      selected={
                        option.category === 'massage'
                          ? isMassageChoice(state.serviceChoice)
                          : state.serviceChoice === OFFERING_CODES.PRIORITY_PASS
                      }
                      label={option.label}
                      className={option.className}
                    />
                  ))}
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
                    selected={isPriorityPassChoice(state.serviceChoice)}
                    label="Yes"
                  />
                  <SelectionButton
                    onClick={() => handleMembershipAnswer(false)}
                    selected={state.serviceChoice === OFFERING_CODES.CHIROPRACTIC}
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
                      onClick={() =>
                        selectService(OFFERING_CODES.PRIORITY_PASS_ADJUSTMENTS)
                      }
                      selected={
                        state.serviceChoice ===
                        OFFERING_CODES.PRIORITY_PASS_ADJUSTMENTS
                      }
                      label="Yes"
                    />
                    <SelectionButton
                      onClick={() => selectService(OFFERING_CODES.PRIORITY_PASS)}
                      selected={
                        state.serviceChoice === OFFERING_CODES.PRIORITY_PASS
                      }
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
                        onClick={() => selectService(option.offeringCode)}
                        selected={state.serviceChoice === option.offeringCode}
                        ariaLabel={`${option.title.replace('Minutes', 'mins')} ${option.price}`}
                        label={
                          (() => {
                            const [durationValue = option.title, durationUnit = ''] =
                              option.title.split(' ');
                            const durationUnitLabel =
                              durationUnit.toLowerCase() === 'minutes' ? 'mins' : durationUnit;
                            return (
                              <span className="text-size-stable flex w-full flex-col items-center justify-center gap-1 text-center">
                                <span className="text-[20px] font-bold leading-none">
                                  {durationValue}
                                </span>
                                <span className="text-[18px] font-bold leading-tight">
                                  {durationUnitLabel}
                                </span>
                                <span className="text-[18px] font-normal leading-tight">
                                  {option.price}
                                </span>
                              </span>
                            );
                          })()
                        }
                        className="min-h-[104px] px-2 py-3"
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
