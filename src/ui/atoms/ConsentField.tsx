/**
 * ConsentField Atom Component
 * 
 * A specialized checkbox field for consent agreement
 */

import { WizardState } from '@/types/wizard';

export interface ConsentFieldProps {
  details: WizardState['details'];
  onUpdateField: (field: keyof WizardState['details'], value: boolean) => void;
  submitAttempted: boolean;
  errors: { [key: string]: string[] };
}

export function ConsentField({ 
  details, 
  onUpdateField, 
  submitAttempted, 
  errors 
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
          I consent to treatment at The Chiroport and understand the associated risks. *
        </span>
      </label>
      {submitAttempted && errors.consent && (
        <p className="text-red-400 text-sm mt-2">{errors.consent[0]}</p>
      )}
    </div>
  );
} 