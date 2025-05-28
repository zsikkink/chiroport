'use client';

import { useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon } from '@heroicons/react/24/solid';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { z } from 'zod';
import ResponsiveCard from './ResponsiveCard';
import { BodyText } from './Typography';
import { PrimaryButton } from './Button';
import { LocationInfo } from '@/utils/locationData';
import { parsePhoneNumberFromString, isValidPhoneNumber, AsYouType } from 'libphonenumber-js';

// ============================================================================
// DATA & TYPES
// ============================================================================

const TREATMENTS = [
  { title: 'Body on the Go', price: '$69', time: '10 min', description: 'Full spinal and neck adjustment' },
  { title: 'Total Wellness', price: '$99', time: '20 min', description: 'Signature service—trigger‑point muscle therapy, full‑body stretch, spinal & neck adjustments' },
  { title: 'Sciatica & Lower Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused relief for sciatica and lower back' },
  { title: 'Neck & Upper Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused relief for neck and upper back' },
  { title: 'Trigger Point Muscle Therapy & Stretch', price: '$89', time: '20 min', description: 'Relieve postural tightness, boost circulation' },
  { title: 'Chiro Massage', price: '$79', time: '20 min', description: 'Thai‑inspired massage with trigger‑point therapy & stretching' },
  { title: 'Chiro Massage Mini', price: '$39', time: '10 min', description: 'Condensed Thai‑inspired massage' },
  { title: 'Undecided', price: '', time: '', description: 'Discuss options with chiropractor' }
] as const;

type Step = 'question' | 'join' | 'nonmember' | 'treatments' | 'details';
type Treatment = (typeof TREATMENTS)[number];

interface WizardState {
  step: Step;
  history: Step[];
  direction: 'forward' | 'back';
  spinalAdjustment: boolean | null;
  selectedTreatment: Treatment | null;
  details: {
    name: string;
    phone: string;
    email: string;
  };
  submitAttempted: boolean;
}

type Action =
  | { type: 'GO_TO'; step: Step }
  | { type: 'GO_BACK' }
  | { type: 'SET_SPINAL'; value: boolean }
  | { type: 'DESELECT_SPINAL' }
  | { type: 'SELECT_TREATMENT'; treatment: Treatment }
  | { type: 'UPDATE_FIELD'; field: keyof WizardState['details']; value: string }
  | { type: 'ATTEMPT_SUBMIT' }
  | { type: 'RESET' };

// ============================================================================
// VALIDATION
// ============================================================================

const detailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required').refine(isValidPhoneNumber, 'Invalid phone number'),
  email: z.string().email('Invalid email')
});

// ============================================================================
// REDUCER
// ============================================================================

const initialState: WizardState = {
  step: 'question',
  history: [],
  direction: 'forward',
  spinalAdjustment: null,
  selectedTreatment: null,
  details: { name: '', phone: '', email: '' },
  submitAttempted: false
};

function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'GO_TO':
      return {
        ...state,
        history: [...state.history, state.step],
        step: action.step,
        direction: 'forward',
        submitAttempted: action.step === 'details' ? false : state.submitAttempted
      };

    case 'GO_BACK':
      const previousStep = state.history[state.history.length - 1] || 'question';
      return {
        ...state,
        step: previousStep,
        history: state.history.slice(0, -1),
        direction: 'back',
        submitAttempted: false
      };

    case 'SET_SPINAL':
      return { ...state, spinalAdjustment: action.value };

    case 'DESELECT_SPINAL':
      return { ...state, spinalAdjustment: null };

    case 'SELECT_TREATMENT':
      return { ...state, selectedTreatment: action.treatment };

    case 'UPDATE_FIELD':
      return {
        ...state,
        details: { ...state.details, [action.field]: action.value }
      };

    case 'ATTEMPT_SUBMIT':
      return { ...state, submitAttempted: true };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// ANIMATION
// ============================================================================

const slideAnimation = (direction: 'forward' | 'back') => ({
  initial: { opacity: 0, x: direction === 'forward' ? 20 : -20, y: 0 },
  animate: { opacity: 1, x: 0, y: 0 },
  exit: { opacity: 0, x: direction === 'forward' ? -20 : 20, y: 0 },
  transition: { duration: 0.3, ease: 'easeInOut' }
});

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} aria-label="Go back" className="text-white flex items-center mb-2">
    <ChevronLeftIcon className="w-6 h-6" />
  </button>
);

const StepHeader = ({ title, showBack = false, onBack }: { title: string; showBack?: boolean; onBack?: () => void }) => (
  <div className={`relative flex items-center mb-6 ${showBack ? '' : 'justify-center'}`}>
    {showBack && onBack && <BackButton onClick={onBack} />}
    <div className={`${showBack ? 'absolute inset-0 flex items-center justify-center pointer-events-none' : ''}`}>
      <BodyText size="2xl" className="font-bold text-white">{title}</BodyText>
    </div>
  </div>
);

const YesNoButtons = ({ 
  onYes, 
  onNo, 
  selected,
  onDeselect
}: { 
  onYes: () => void; 
  onNo: () => void; 
  selected: boolean | null;
  onDeselect?: () => void;
}) => (
  <div className="flex gap-4">
    <button
      onClick={() => selected === true && onDeselect ? onDeselect() : onYes()} 
      className={`
        w-full text-lg font-semibold rounded-lg p-4 border-2 border-white transition-colors duration-200
        ${selected === true 
          ? 'bg-white text-[#56655A]' 
          : 'bg-transparent text-white hover:bg-white/10'
        }
      `}
    >
      Yes
    </button>
    <button
      onClick={() => selected === false && onDeselect ? onDeselect() : onNo()} 
      className={`
        w-full text-lg font-semibold rounded-lg p-4 border-2 border-white transition-colors duration-200
        ${selected === false 
          ? 'bg-white text-[#56655A]' 
          : 'bg-transparent text-white hover:bg-white/10'
        }
      `}
    >
      No
    </button>
  </div>
);

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
    <label className="block text-white text-sm font-medium mb-2">
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
  errors: any;
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
      <label className="block text-white text-sm font-medium mb-2">
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

// ============================================================================
// STEP COMPONENTS
// ============================================================================

const MembershipStep = ({ onYes, onNo }: { onYes: () => void; onNo: () => void }) => (
  <div className="space-y-4 py-4">
    <BodyText size="2xl" className="font-medium text-white">
      Priority Pass or Lounge Key member?
    </BodyText>
    <YesNoButtons onYes={onYes} onNo={onNo} selected={null} onDeselect={undefined} />
  </div>
);

const JoinStep = ({ 
  spinalAdjustment, 
  onSetSpinal, 
  onBack,
  onDeselectSpinal
}: { 
  spinalAdjustment: boolean | null;
  onSetSpinal: (value: boolean) => void;
  onBack: () => void;
  onDeselectSpinal: () => void;
}) => (
  <div className="space-y-4 py-4">
    <BackButton onClick={onBack} />
    <BodyText size="2xl" className="font-medium text-white">
      Stretching, muscle work, and massage—Priority Pass & Lounge Key only
    </BodyText>
    <div className="space-y-3">
      <BodyText size="2xl" className="text-white">
        Add spinal & neck adjustments for $29 <span className="font-semibold">(58% Off!)</span>
      </BodyText>
      <YesNoButtons 
        onYes={() => onSetSpinal(true)} 
        onNo={() => onSetSpinal(false)} 
        selected={spinalAdjustment}
        onDeselect={onDeselectSpinal}
      />
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
    <PrimaryButton onClick={onProceed} fullWidth className="text-lg font-semibold">
      Join Queue
    </PrimaryButton>
    <PrimaryButton onClick={onSchedule} fullWidth className="text-lg font-semibold">
      Schedule a Future Treatment
    </PrimaryButton>
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
    <StepHeader title="Select Service" showBack onBack={onBack} />
    <div className="space-y-3">
      {TREATMENTS.map((treatment) => (
        <button
          key={treatment.title}
          onClick={() => onSelect(treatment)}
          className="w-full bg-primary text-white rounded-lg p-4 text-left border-2 border-white hover:bg-primary/90 transition-colors duration-200"
        >
          <h3 className="font-bold text-lg mb-1">{treatment.title}</h3>
          {treatment.price && treatment.time && (
            <div className="text-sm font-bold mb-2 opacity-90">
              {treatment.price} • {treatment.time}
            </div>
          )}
          <p className="text-base opacity-90 leading-relaxed">{treatment.description}</p>
        </button>
      ))}
    </div>
  </div>
);

const DetailsStep = ({ 
  details, 
  onUpdateField, 
  onSubmit, 
  onBack, 
  submitAttempted 
}: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitAttempted: boolean;
}) => {
  const validation = detailsSchema.safeParse(details);
  const errors = validation.success ? {} : validation.error.formErrors.fieldErrors;

  return (
    <div className="space-y-4 py-4">
      <div className="relative flex items-center mb-6">
        <BackButton onClick={onBack} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <BodyText size="2xl" className="font-bold text-white text-center">Enter your details</BodyText>
        </div>
      </div>

      <InputField
        label="Name"
        value={details.name}
        onChange={(value) => onUpdateField('name', value)}
        placeholder="Full name"
        error={submitAttempted ? errors.name?.[0] : undefined}
        required
      />

      <PhoneField
        details={details}
        onUpdateField={onUpdateField}
        submitAttempted={submitAttempted}
        errors={errors}
      />

      <InputField
        label="Email Address"
        type="email"
        value={details.email}
        onChange={(value) => onUpdateField('email', value)}
        placeholder="Email address"
        error={submitAttempted ? errors.email?.[0] : undefined}
        required
      />

      <PrimaryButton onClick={onSubmit} fullWidth className="text-lg font-semibold mt-6">
        Submit
      </PrimaryButton>
    </div>
  );
};

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
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const goTo = (step: Step) => dispatch({ type: 'GO_TO', step });
  const goBack = () => dispatch({ type: 'GO_BACK' });

  const handleSubmit = () => {
    dispatch({ type: 'ATTEMPT_SUBMIT' });
    
    const validation = detailsSchema.safeParse(state.details);
    if (validation.success) {
      console.log('SUBMIT', { 
        treatment: state.selectedTreatment, 
        spinalAdjustment: state.spinalAdjustment,
        ...state.details 
      });
      dispatch({ type: 'RESET' });
    }
  };

  const renderStep = () => {
    const animationProps = slideAnimation(state.direction);

    switch (state.step) {
      case 'question':
        return (
          <motion.div key={state.step} {...animationProps}>
            <MembershipStep
              onYes={() => goTo('join')}
              onNo={() => goTo('nonmember')}
            />
          </motion.div>
        );

      case 'join':
        return (
          <motion.div key={state.step} {...animationProps}>
            <JoinStep
              spinalAdjustment={state.spinalAdjustment}
              onSetSpinal={(value) => {
                dispatch({ type: 'SET_SPINAL', value });
                goTo('details');
              }}
              onBack={goBack}
              onDeselectSpinal={() => dispatch({ type: 'DESELECT_SPINAL' })}
            />
          </motion.div>
        );

      case 'nonmember':
        return (
          <motion.div key={state.step} {...animationProps}>
            <NonMemberStep
              onProceed={() => goTo('treatments')}
              onSchedule={() => console.log('Schedule future treatment')}
              onBack={goBack}
            />
          </motion.div>
        );

      case 'treatments':
        return (
          <motion.div key={state.step} {...animationProps}>
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
          <motion.div key={state.step} {...animationProps}>
            <DetailsStep
              details={state.details}
              onUpdateField={(field, value) => dispatch({ type: 'UPDATE_FIELD', field, value })}
              onSubmit={handleSubmit}
              onBack={goBack}
              submitAttempted={state.submitAttempted}
            />
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
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </ResponsiveCard>
    </div>
  );
}
