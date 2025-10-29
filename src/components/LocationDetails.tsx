'use client';

import { useReducer, useEffect, useState } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import { ChevronLeftIcon } from '@heroicons/react/24/solid';
import 'react-phone-number-input/style.css';
import { z } from 'zod';
import ResponsiveCard from './ResponsiveCard';
import { BodyText } from './Typography';
import { LocationInfo } from '@/utils/locationData';
import { FormSubmissionData } from '@/types/waitwhile';
import { isValidPhoneNumber, AsYouType } from 'libphonenumber-js';
import { submitFormSecurely, formSubmissionLimiter } from '@/utils/client-api';

// Define the expected API response structure
interface SubmissionResponse {
  visitId: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
}

// ============================================================================
// DATA & TYPES
// ============================================================================

const TREATMENTS = [
  { title: 'Body on the Go', price: '$69', time: '10 min', description: 'Full spinal and neck adjustment' },
  { title: 'Total Wellness', price: '$99', time: '20 min', description: 'Our signature service—trigger point muscle therapy, full-body stretch, and complete spinal & neck adjustments' },
  { title: 'Sciatica & Lower Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve sciatica and lower back discomfort' },
  { title: 'Neck & Upper Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve neck and upper back discomfort' },
  { title: 'Trigger Point Muscle Therapy & Stretch', price: '$89', time: '20 min', description: 'Relieve postural muscle tightness from travel, enhance blood flow, and calm your nervous system' },
  { title: 'Chiro Massage', price: '$79', time: '20 min', description: 'Thai-inspired massage blending trigger-point muscle therapy, dynamic stretching, and mechanical massagers' },
  { title: 'Chiro Massage Mini', price: '$39', time: '10 min', description: 'Thai-inspired massage blending trigger-point muscle therapy and mechanical massagers' },
  { title: 'Undecided', price: '', time: '', description: 'Not sure which therapy is right? Discuss your needs with our chiropractor to choose the best treatment' }
] as const;

const MASSAGE_OPTIONS = [
  { title: '15 Minutes', price: '$55', time: '', description: '' },
  { title: '20 Minutes', price: '$65', time: '', description: '' },
  { title: '30 Minutes', price: '$85', time: '', description: '' },
] as const;

type Step =
  | 'category'
  | 'question'
  | 'join'
  | 'nonmember'
  | 'treatments'
  | 'details'
  | 'success'
  | 'massage_options';

type IntakeCategory = 'standard' | 'offers_massage';
type VisitCategory = 'priority_pass' | 'chiropractor' | 'massage';
type Treatment = (typeof TREATMENTS)[number] | (typeof MASSAGE_OPTIONS)[number];

interface WizardState {
  step: Step;
  history: Step[];
  isMember: boolean | null;
  spinalAdjustment: boolean | null;
  selectedTreatment: Treatment | null;
  visitCategory: VisitCategory | null;
  details: {
    name: string;
    phone: string;
    email: string;
    birthday: string;
    discomfort: string[];
    additionalInfo: string;
    consent: boolean;
  };
  submitAttempted: boolean;
  isSubmitting: boolean;
  submissionError: string | null;
  submissionSuccess: {
    customerId: string;
    visitId: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
  } | null;
}

type Action =
  | { type: 'GO_TO'; step: Step }
  | { type: 'GO_BACK' }
  | { type: 'SET_MEMBER'; value: boolean }
  | { type: 'SET_SPINAL'; value: boolean }
  | { type: 'DESELECT_SPINAL' }
  | { type: 'SELECT_TREATMENT'; treatment: Treatment }
  | { type: 'SET_VISIT_CATEGORY'; value: VisitCategory | null }
  | { type: 'CLEAR_SELECTED_TREATMENT' }
  | { type: 'UPDATE_FIELD'; field: keyof WizardState['details']; value: string | boolean }
  | { type: 'UPDATE_DISCOMFORT'; values: string[] }
  | { type: 'ATTEMPT_SUBMIT' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: { customerId: string; visitId: string; queuePosition?: number; estimatedWaitTime?: number } }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET'; step: Step };

const FLOW_CONFIG: Record<IntakeCategory, { initialStep: Step; steps: Step[] }> = {
  standard: {
    initialStep: 'question',
    steps: ['question', 'join', 'nonmember', 'treatments', 'details', 'success'],
  },
  offers_massage: {
    initialStep: 'category',
    steps: ['category', 'join', 'treatments', 'massage_options', 'details', 'success'],
  },
};

type FlowTransitionMap = {
  afterMemberYes?: Step;
  afterMemberNo?: Step;
  afterSpinalDecision?: Step;
  afterTreatmentSelection: Step;
  category?: {
    priorityPass: Step;
    chiropractor: Step;
    massage: Step;
  };
};

const FLOW_TRANSITIONS: Record<IntakeCategory, FlowTransitionMap> = {
  standard: {
    afterMemberYes: 'join',
    afterMemberNo: 'treatments',
    afterSpinalDecision: 'details',
    afterTreatmentSelection: 'details',
  },
  offers_massage: {
    afterTreatmentSelection: 'details',
    category: {
      priorityPass: 'join',
      chiropractor: 'treatments',
      massage: 'massage_options',
    },
  },
};

const createEmptyDetails = (): WizardState['details'] => ({
  name: '',
  phone: '',
  email: '',
  birthday: '',
  discomfort: [],
  additionalInfo: '',
  consent: false,
});

const createWizardInitialState = (initialStep: Step): WizardState => ({
  step: initialStep,
  history: [],
  isMember: null,
  spinalAdjustment: null,
  selectedTreatment: null,
  visitCategory: null,
  details: createEmptyDetails(),
  submitAttempted: false,
  isSubmitting: false,
  submissionError: null,
  submissionSuccess: null,
});

// ============================================================================
// VALIDATION
// ============================================================================

// Custom phone validation that handles US numbers properly
const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return false;
  
  // If it starts with +, it's international - validate as-is
  if (phone.startsWith('+')) {
    return isValidPhoneNumber(phone);
  }
  
  // For US numbers (just digits), add +1 country code for validation
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return isValidPhoneNumber(`+1${digitsOnly}`);
  }
  
  return false;
};

const isValidBirthday = (date: string): boolean => {
  const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
  if (!dateRegex.test(date)) return false;

  const parts = date.split('/').map(Number);
  const [month, day, year] = parts;

  if (month === undefined || day === undefined || year === undefined) return false;

  const dateObj = new Date(year, month - 1, day);

  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day &&
    year >= 1900 &&
    year <= new Date().getFullYear()
  );
};

const createDetailsSchema = ({
  requireDiscomfort,
  requireEmail,
  requireBirthday,
}: {
  requireDiscomfort: boolean;
  requireEmail: boolean;
  requireBirthday: boolean;
}) =>
  z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z
      .string()
      .min(1, 'Phone is required')
      .refine(validatePhoneNumber, 'Invalid phone number'),
    email: requireEmail ? z.string().email('Invalid email') : z.string().optional(),
    birthday: requireBirthday
      ? z
          .string()
          .min(1, 'Birthday is required')
          .refine((date) => isValidBirthday(date), 'Invalid date format (MM/DD/YYYY)')
      : z.string().optional(),
    discomfort: requireDiscomfort
      ? z.array(z.string()).min(1, 'Please select at least one option')
      : z.array(z.string()),
    additionalInfo: z.string().optional(),
    consent: z.boolean().refine((val) => val === true, 'You must consent to treatment to proceed'),
  });

// ============================================================================
// REDUCER
// ============================================================================

function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'GO_TO':
      return {
        ...state,
        ...(action.step === 'category'
          ? {
              visitCategory: null,
              isMember: null,
              spinalAdjustment: null,
              selectedTreatment: null,
            }
          : {}),
        history: [...state.history, state.step],
        step: action.step,
        submitAttempted: action.step === 'details' ? false : state.submitAttempted
      };

    case 'GO_BACK':
      const previousStep = state.history[state.history.length - 1] || 'question';
      return {
        ...state,
        ...(previousStep === 'category'
          ? {
              visitCategory: null,
              isMember: null,
              spinalAdjustment: null,
              selectedTreatment: null,
            }
          : {}),
        step: previousStep,
        history: state.history.slice(0, -1),
        submitAttempted: false
      };

    case 'SET_MEMBER':
      return { ...state, isMember: action.value };

    case 'SET_SPINAL':
      return { ...state, spinalAdjustment: action.value };

    case 'DESELECT_SPINAL':
      return { ...state, spinalAdjustment: null };

    case 'SELECT_TREATMENT':
      return { ...state, selectedTreatment: action.treatment };

    case 'SET_VISIT_CATEGORY':
      return { ...state, visitCategory: action.value };

    case 'CLEAR_SELECTED_TREATMENT':
      return { ...state, selectedTreatment: null };

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

    case 'SUBMIT_START':
      return { ...state, isSubmitting: true };

    case 'SUBMIT_SUCCESS':
      return {
        ...state,
        isSubmitting: false,
        submissionSuccess: action.payload,
        submissionError: null
      };

    case 'SUBMIT_ERROR':
      return {
        ...state,
        isSubmitting: false,
        submissionError: action.error
      };

    case 'RESET':
      return createWizardInitialState(action.step);

    default:
      return state;
  }
}

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

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  selected?: boolean;
  persistSelection?: boolean;
}

const AnimatedButton = ({
  children,
  onClick,
  className = '',
  disabled = false,
  selected = false,
  persistSelection = true
}: AnimatedButtonProps) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    
    // Start animation immediately
    setIsAnimating(true);
    
    // Delay the actual navigation by 0.2 seconds
    setTimeout(() => {
      onClick();
    }, 200);
    
    // Reset animation state after 0.5 seconds
    setTimeout(() => {
      setIsAnimating(false);
    }, 500);
  };

  return (
    <div className="relative w-full">
      <button
        onClick={handleClick}
        disabled={disabled}
        data-selected={selected}
        className={`
          relative w-full text-lg font-semibold rounded-lg p-4 border-2 border-white 
          transition-all duration-200 overflow-hidden
          bg-primary hover:bg-[#475549] text-white shadow-lg
          min-h-[3rem] flex items-center justify-center
          ${selected && (persistSelection || isAnimating)
            ? 'bg-white text-[#56655A] hover:bg-gray-100' 
            : 'bg-primary hover:bg-[#475549] text-white'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
          ${isAnimating ? 'animate-pulse border-white/80' : ''}
        `}
        style={{
          ...(isAnimating && {
            boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.6), 0 0 0 4px rgba(255, 255, 255, 0.3)',
            transform: 'scale(1.02)',
          })
        }}
      >
        <span className="relative z-10 text-center w-full">
          {children}
        </span>
      </button>
    </div>
  );
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} aria-label="Go back" className="text-white flex items-center mb-2">
    <ChevronLeftIcon className="w-6 h-6" />
  </button>
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
    <AnimatedButton
      onClick={() => selected === true && onDeselect ? onDeselect() : onYes()}
      selected={selected === true}
    >
      Yes
    </AnimatedButton>
    <AnimatedButton
      onClick={() => selected === false && onDeselect ? onDeselect() : onNo()}
      selected={selected === false}
    >
      No
    </AnimatedButton>
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

function BirthdayField({ details, onUpdateField, submitAttempted, errors }: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string) => void;
  submitAttempted: boolean;
  errors: { [key: string]: string[] };
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
  errors: { [key: string]: string[] };
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
  onSelect
}: {
  selectedCategory: VisitCategory | null;
  onSelect: (category: VisitCategory) => void;
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
        Massage
      </AnimatedButton>
    </div>
  </div>
);

const MassageOptionsStep = ({
  selectedTreatment,
  onSelect,
  onBack
}: {
  selectedTreatment: Treatment | null;
  onSelect: (treatment: Treatment) => void;
  onBack: () => void;
}) => (
  <div className="space-y-6 py-4">
    <div className="relative flex items-center mb-4">
      <BackButton onClick={onBack} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <BodyText size="2xl" className="font-bold text-white text-center px-8">
          Chair Massage
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
  submissionError,
  requireDiscomfort,
  requireEmail,
  requireBirthday,
  additionalInfoLabel,
  consentLabel,
  showEmailField,
  showBirthdayField,
  showAdditionalInfoField
}: {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string | boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitAttempted: boolean;
  dispatch: (action: Action) => void;
  isSubmitting: boolean;
  submissionError: string | null;
  requireDiscomfort: boolean;
  requireEmail: boolean;
  requireBirthday: boolean;
  additionalInfoLabel: string;
  consentLabel: string;
  showEmailField: boolean;
  showBirthdayField: boolean;
  showAdditionalInfoField: boolean;
}) => {
  const validationPayload = {
    name: details.name,
    phone: details.phone,
    email: showEmailField ? details.email : undefined,
    birthday: showBirthdayField ? details.birthday : undefined,
    discomfort: requireDiscomfort ? details.discomfort : [],
    additionalInfo: showAdditionalInfoField ? details.additionalInfo : undefined,
    consent: details.consent,
  };

  const validation = createDetailsSchema({
    requireDiscomfort,
    requireEmail,
    requireBirthday,
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

      {showBirthdayField && (
        <BirthdayField
          details={details}
          onUpdateField={(field, value) => onUpdateField(field, value as string)}
          submitAttempted={submitAttempted}
          errors={errors}
        />
      )}

      {requireDiscomfort && (
        <DiscomfortField
          details={details}
          onUpdateDiscomfort={(values) => dispatch({ type: 'UPDATE_DISCOMFORT', values })}
          submitAttempted={submitAttempted}
          errors={errors}
        />
      )}

      {showAdditionalInfoField && (
        <TextAreaField
          label={additionalInfoLabel}
          value={details.additionalInfo}
          onChange={(value) => onUpdateField('additionalInfo', value)}
          placeholder="Add any additional information"
          {...(submitAttempted && errors.additionalInfo?.[0] ? { error: errors.additionalInfo[0] } : {})}
          required={false}
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
  const intakeCategory: IntakeCategory = locationInfo.intakeCategory ?? 'standard';
  const flowConfig = FLOW_CONFIG[intakeCategory];
  const flowTransitions = FLOW_TRANSITIONS[intakeCategory];
  const [state, dispatch] = useReducer(
    wizardReducer,
    flowConfig.initialStep,
    (initialStep: Step) => createWizardInitialState(initialStep)
  );
  const isMassageVisitor = state.visitCategory === 'massage';
  const requireDiscomfort = !isMassageVisitor;
  const showEmailField = !isMassageVisitor;
  const showBirthdayField = !isMassageVisitor;
  const showAdditionalInfoField = !isMassageVisitor;
  const requireEmail = showEmailField;
  const requireBirthday = showBirthdayField;
  const additionalInfoLabel = isMassageVisitor
    ? 'Is there anything else you would like the therapist to know? (Optional)'
    : 'Is there anything else you would like the chiropractor to know? (Optional)';
  const consentLabel = isMassageVisitor
    ? 'I consent to receive massage therapy and release the therapist and business from liability for any normal reactions or unintended effects except in cases of negligence.'
    : 'I consent to receive chiropractic care, have disclosed any health conditions, and release the chiropractor and business from liability for any normal reactions or unintended effects except in cases of negligence.';

  // Scroll to top when navigating between service menu and details
  useEffect(() => {
    if (state.step === 'treatments' || state.step === 'details' || state.step === 'massage_options') {
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
      email: showEmailField ? state.details.email : undefined,
      birthday: showBirthdayField ? state.details.birthday : undefined,
      discomfort: requireDiscomfort ? state.details.discomfort : [],
      additionalInfo: showAdditionalInfoField ? state.details.additionalInfo : undefined,
      consent: state.details.consent,
    };

    const validation = createDetailsSchema({
      requireDiscomfort,
      requireEmail,
      requireBirthday,
    }).safeParse(validationPayload);
    if (!validation.success) {
      return; // Form validation failed, errors will be shown
    }

    // Start submission
    dispatch({ type: 'SUBMIT_START' });

    try {
      // Apply client-side rate limiting
      await formSubmissionLimiter.throttle();

      // Prepare form data for API (no serviceId needed anymore)
      const formData: FormSubmissionData = {
        name: validationPayload.name,
        phone: validationPayload.phone,
        discomfort: validationPayload.discomfort,
        consent: validationPayload.consent,
        selectedTreatment: state.selectedTreatment,
        spinalAdjustment: state.spinalAdjustment,
        locationId: locationInfo.waitwhileLocationId
      };

      if (showEmailField && validationPayload.email) {
        formData.email = validationPayload.email;
      }

      if (showBirthdayField && validationPayload.birthday) {
        formData.birthday = validationPayload.birthday;
      }

      if (showAdditionalInfoField && validationPayload.additionalInfo) {
        formData.additionalInfo = validationPayload.additionalInfo;
      }

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
                goTo(flowTransitions.afterMemberNo ?? 'treatments');
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
                goTo(flowTransitions.afterTreatmentSelection);
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
              requireDiscomfort={requireDiscomfort}
              requireEmail={requireEmail}
              requireBirthday={requireBirthday}
              additionalInfoLabel={additionalInfoLabel}
              consentLabel={consentLabel}
              showEmailField={showEmailField}
              showBirthdayField={showBirthdayField}
              showAdditionalInfoField={showAdditionalInfoField}
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
                goTo(categoryTransitions.priorityPass);
              } else if (category === 'chiropractor') {
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
            onSelect={(treatment) => {
              dispatch({ type: 'SELECT_TREATMENT', treatment });
              goTo(flowTransitions.afterTreatmentSelection);
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
