/**
 * DetailsStep Component
 * 
 * Step for collecting user details and form submission
 */

import { BodyText } from '@/components/Typography';
import { 
  BackButton, 
  AnimatedButton, 
  InputField, 
  PhoneField, 
  BirthdayField, 
  DiscomfortField, 
  ConsentField, 
  TextAreaField 
} from '@/ui/atoms';
import { WizardState, WizardAction } from '@/types/wizard';
import { detailsSchema } from '@/validation/detailsSchema';

export interface DetailsStepProps {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string | boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitAttempted: boolean;
  dispatch: (action: WizardAction) => void;
  isSubmitting: boolean;
  submissionError: string | null;
}

export function DetailsStep({
  details,
  onUpdateField,
  onSubmit,
  onBack,
  submitAttempted,
  dispatch,
  isSubmitting,
  submissionError
}: DetailsStepProps) {
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
} 