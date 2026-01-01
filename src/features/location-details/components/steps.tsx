'use client';

import { BodyText } from '@/components/ui';
import { detailsSchemaFactory } from '@/schemas/intake';
import type { TreatmentOption, VisitCategory, WizardState } from '@/features/location-details/types';
import { MASSAGE_OPTIONS } from '@/features/location-details/config';
import AnimatedButton from '@/features/location-details/components/AnimatedButton';
import BackButton from '@/features/location-details/components/BackButton';
import { ConsentField, InputField, PhoneField } from '@/features/location-details/components/fields';
import YesNoButtons from '@/features/location-details/components/YesNoButtons';

const createDetailsSchema = detailsSchemaFactory;

export const MembershipStep = ({ onYes, onNo }: { onYes: () => void; onNo: () => void }) => (
  <div className="space-y-4 py-4">
    <BodyText size="2xl" className="font-medium text-white">
      Priority Pass or Lounge Key member?
    </BodyText>
    <YesNoButtons onYes={onYes} onNo={onNo} selected={null} />
  </div>
);

export const JoinStep = ({
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

export const NonMemberStep = ({
  onProceed,
  onSchedule,
  onBack,
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

export const CategoryStep = ({
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

export const MassageOptionsStep = ({
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

export const DetailsStep = ({
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
          <BodyText size="3xl" className="font-bold text-white text-center">
            Enter your details
          </BodyText>
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
        <AnimatedButton onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Joining Queue...' : 'Join Queue'}
        </AnimatedButton>
      </div>
    </div>
  );
};

export const SuccessStep = () => (
  <div className="space-y-6 py-4 text-center">
    <div className="mb-6">
      <BodyText size="3xl" className="font-bold text-white mb-4">
        🎉 You&apos;re in the queue! 🎉
      </BodyText>
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
