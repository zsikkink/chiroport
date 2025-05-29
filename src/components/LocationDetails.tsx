'use client';

import { useReducer, useEffect } from 'react';
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
  { title: 'Total Wellness', price: '$99', time: '20 min', description: 'Our signature service—trigger point muscle therapy, full-body stretch, and complete spinal & neck adjustments' },
  { title: 'Sciatica & Lower Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve sciatica and lower back discomfort' },
  { title: 'Neck & Upper Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve neck and upper back discomfort' },
  { title: 'Trigger Point Muscle Therapy & Stretch', price: '$89', time: '20 min', description: 'Relieve postural muscle tightness from travel, enhance blood flow, and calm your nervous system' },
  { title: 'Chiro Massage', price: '$79', time: '20 min', description: 'A Thai-inspired massage blending trigger-point muscle therapy, dynamic stretching, and mechanical massagers' },
  { title: 'Chiro Massage Mini', price: '$39', time: '10 min', description: 'A Thai-inspired massage blending trigger-point muscle therapy and mechanical massagers' },
  { title: 'Undecided', price: '', time: '', description: 'Not sure which therapy is right? Discuss your needs with our chiropractor to choose the best treatment' }
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
    birthday: string;
    discomfort: string[];
    additionalInfo: string;
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
  | { type: 'UPDATE_DISCOMFORT'; values: string[] }
  | { type: 'ATTEMPT_SUBMIT' }
  | { type: 'RESET' };

// ============================================================================
// VALIDATION
// ============================================================================

const detailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required').refine(isValidPhoneNumber, 'Invalid phone number'),
  email: z.string().email('Invalid email'),
  birthday: z.string().min(1, 'Birthday is required').refine((date) => {
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
    if (!dateRegex.test(date)) return false;
    
    const [month, day, year] = date.split('/').map(Number);
    const dateObj = new Date(year, month - 1, day);
    
    // Check if the date is valid and matches the input
    return dateObj.getFullYear() === year && 
           dateObj.getMonth() === month - 1 && 
           dateObj.getDate() === day &&
           year >= 1900 && 
           year <= new Date().getFullYear();
  }, 'Invalid date format (MM/DD/YYYY)'),
  discomfort: z.array(z.string()).min(1, 'Please select at least one option'),
  additionalInfo: z.string().optional()
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
  details: { name: '', phone: '', email: '', birthday: '', discomfort: [], additionalInfo: '' },
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

    case 'UPDATE_DISCOMFORT':
      return {
        ...state,
        details: { ...state.details, discomfort: action.values }
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

function BirthdayField({ details, onUpdateField, submitAttempted, errors }: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string) => void;
  submitAttempted: boolean;
  errors: any;
}) {
  // Format birthday as MM/DD/YYYY
  const formatBirthday = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
  };

  const handleBirthdayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Extract only digits and format
    const digitsOnly = value.replace(/\D/g, '');
    // Limit to 8 digits (MMDDYYYY)
    const limited = digitsOnly.slice(0, 8);
    const formatted = formatBirthday(limited);
    onUpdateField('birthday', formatted);
  };

  return (
    <div>
      <label className="block text-white text-base font-bold mb-2">
        Birthday *
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={details.birthday || ''}
        onChange={handleBirthdayChange}
        placeholder="MM/DD/YYYY"
        className="w-full bg-white text-black rounded-lg p-4 border-2 border-white focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500"
      />
      {submitAttempted && errors.birthday && (
        <p className="text-red-400 text-sm mt-1">{errors.birthday[0]}</p>
      )}
    </div>
  );
}

const DISCOMFORT_OPTIONS = [
  'Neck Tension or Stiffness',
  'Headache',
  'Upper Back Tightness',
  'Lower Back Tightness',
  'Sciatica',
  'General Soreness',
  'No discomfort'
] as const;

function DiscomfortField({ details, onUpdateDiscomfort, submitAttempted, errors }: {
  details: WizardState['details'];
  onUpdateDiscomfort: (values: string[]) => void;
  submitAttempted: boolean;
  errors: any;
}) {
  const handleCheckboxChange = (option: string, checked: boolean) => {
    let newDiscomfort = [...details.discomfort];
    
    if (option === 'No discomfort') {
      // If "No discomfort" is selected, clear all others
      if (checked) {
        newDiscomfort = ['No discomfort'];
      } else {
        newDiscomfort = [];
      }
    } else {
      // If any other option is selected, remove "No discomfort"
      if (checked) {
        newDiscomfort = newDiscomfort.filter(item => item !== 'No discomfort');
        newDiscomfort.push(option);
      } else {
        newDiscomfort = newDiscomfort.filter(item => item !== option);
      }
    }
    
    onUpdateDiscomfort(newDiscomfort);
  };

  return (
    <div>
      <label className="block text-white text-base font-bold mb-3">
        Where are you experiencing discomfort? (Select all that apply) *
      </label>
      <div className="space-y-3">
        {DISCOMFORT_OPTIONS.map((option) => {
          const isChecked = details.discomfort.includes(option);
          return (
            <label
              key={option}
              className="flex items-center cursor-pointer group"
            >
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => handleCheckboxChange(option, e.target.checked)}
                  className="sr-only"
                />
                <div className={`
                  w-5 h-5 rounded border-2 border-white flex items-center justify-center transition-colors duration-200
                  ${isChecked 
                    ? 'bg-white' 
                    : 'bg-transparent group-hover:bg-white/10'
                  }
                `}>
                  {isChecked && (
                    <svg className="w-3 h-3 text-[#56655A]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="ml-3 text-white text-base">{option}</span>
            </label>
          );
        })}
      </div>
      {submitAttempted && errors.discomfort && (
        <p className="text-red-400 text-sm mt-2">{errors.discomfort[0]}</p>
      )}
    </div>
  );
}

const TextAreaField = ({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  error,
  required = false
}: {
  label: string;
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
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full bg-white text-black rounded-lg p-4 border-2 border-white focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500 resize-vertical"
    />
    {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
  </div>
);

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
      This service includes stretching, muscle work, and massage—Priority Pass & Lounge Key only
    </BodyText>
    <div className="space-y-3">
      <BodyText size="2xl" className="text-white">
      Save 58%! Would you like spinal & neck adjustments for just $29?
      </BodyText>
      <div className="flex gap-4">
        <PrimaryButton
          onClick={() => onSetSpinal(true)}
          fullWidth
          className="text-lg font-semibold"
        >
          Yes
        </PrimaryButton>
        <PrimaryButton
          onClick={() => onSetSpinal(false)}
          fullWidth
          className="text-lg font-semibold"
        >
          No
        </PrimaryButton>
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
    <div className="relative flex items-center mb-6">
      <BackButton onClick={onBack} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <BodyText size="3xl" className="font-bold text-white text-center">Select Service</BodyText>
      </div>
    </div>
    <div className="space-y-3">
      {TREATMENTS.map((treatment) => (
        <button
          key={treatment.title}
          onClick={() => onSelect(treatment)}
          className="w-full bg-primary text-white rounded-lg p-4 text-left border-2 border-white hover:bg-primary-dark transition-colors duration-200"
        >
          <h3 className="font-bold text-lg mb-1">{treatment.title}</h3>
          {treatment.price && treatment.time && (
            <div className="text-sm font-bold mb-2">
              {treatment.price} • {treatment.time}
            </div>
          )}
          <p className="text-base leading-relaxed">{treatment.description}</p>
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
  submitAttempted,
  dispatch
}: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitAttempted: boolean;
  dispatch: (action: Action) => void;
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

      <BirthdayField
        details={details}
        onUpdateField={onUpdateField}
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
        error={submitAttempted ? errors.additionalInfo?.[0] : undefined}
        required={false}
      />

      <PrimaryButton onClick={onSubmit} fullWidth className="text-lg font-semibold mt-6">
        Join Queue
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

  // Scroll to top when navigating between service menu and details
  useEffect(() => {
    if (state.step === 'treatments' || state.step === 'details') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.step]);

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
              onNo={() => goTo('treatments')}
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
              dispatch={dispatch}
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
