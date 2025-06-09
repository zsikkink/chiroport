/**
 * DiscomfortField Atom Component
 * 
 * A specialized checkbox field for selecting discomfort areas
 */

import { DISCOMFORT_OPTIONS } from '@/constants/treatments';
import { WizardState } from '@/types/wizard';

export interface DiscomfortFieldProps {
  details: WizardState['details'];
  onUpdateDiscomfort: (values: string[]) => void;
  submitAttempted: boolean;
  errors: { [key: string]: string[] };
}

export function DiscomfortField({ 
  details, 
  onUpdateDiscomfort, 
  submitAttempted, 
  errors 
}: DiscomfortFieldProps) {
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