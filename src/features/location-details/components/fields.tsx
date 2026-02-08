'use client';

import { AsYouType } from 'libphonenumber-js';
import type { ReactNode } from 'react';
import type { WizardState } from '@/features/location-details/types';

interface InputFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  required?: boolean;
}

export function InputField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
}: InputFieldProps) {
  return (
    <div>
      <label className="block text-slate-700 text-base font-bold mb-2">
        {label} {required && '*'}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white text-slate-900 rounded-lg p-4 border-2 border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-100 placeholder-gray-500"
      />
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  );
}

interface PhoneFieldProps {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: string) => void;
  submitAttempted: boolean;
  errors: { [key: string]: string[] };
}

export function PhoneField({
  details,
  onUpdateField,
  submitAttempted,
  errors,
}: PhoneFieldProps) {
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
      <label className="block text-slate-700 text-base font-bold mb-2">
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
          className="w-full bg-white text-slate-900 rounded-lg p-4 border-2 border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-100 placeholder-gray-500"
        />
      ) : (
        // — U.S. formatting —
        <input
          type="tel"
          value={formatUSPhone(details.phone || '')}
          onChange={handlePhoneChange}
          placeholder="Phone number"
          className="w-full bg-white text-slate-900 rounded-lg p-4 border-2 border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-100 placeholder-gray-500"
        />
      )}

      {submitAttempted && errors.phone && (
        <p className="text-red-400 text-sm mt-1">{errors.phone[0]}</p>
      )}
    </div>
  );
}

interface ConsentFieldProps {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: boolean) => void;
  submitAttempted: boolean;
  errors: { [key: string]: string[] };
  label: ReactNode;
}

export function ConsentField({
  details,
  onUpdateField,
  submitAttempted,
  errors,
  label,
}: ConsentFieldProps) {
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
          <div
            className={`
            w-5 h-5 rounded border-2 border-slate-300 flex items-center justify-center transition-colors duration-200
            ${isChecked 
              ? 'bg-emerald-50' 
              : 'bg-transparent group-hover:bg-slate-100'
            }
          `}
          >
            {isChecked && (
              <svg className="w-3 h-3 text-emerald-700" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>
        <span className="ml-3 text-slate-700 text-base leading-relaxed">
          {label} *
        </span>
      </label>
      {submitAttempted && errors.consent && (
        <p className="text-red-400 text-sm mt-2">{errors.consent[0]}</p>
      )}
    </div>
  );
}
