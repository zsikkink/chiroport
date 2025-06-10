/**
 * TreatmentsStep Component
 * 
 * Step for selecting treatment services
 */

import { BodyText } from '@/components/Typography';
import { BackButton, AnimatedButton } from '@/ui/atoms';
import { TREATMENTS } from '@/constants/treatments';
import { Treatment } from '@/types/wizard';

export interface TreatmentsStepProps {
  onSelect: (treatment: Treatment) => void;
  onBack: () => void;
}

export function TreatmentsStep({ onSelect, onBack }: TreatmentsStepProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="relative flex items-center justify-between mb-6 sm:mb-8">
        <BackButton onClick={onBack} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <BodyText size="3xl" className="font-bold text-white text-center">Select Service</BodyText>
        </div>
        <div className="w-10"></div>
      </div>
      <div>
        {TREATMENTS.map((treatment, index) => (
          <div key={treatment.title}>
            <AnimatedButton 
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
            {index !== TREATMENTS.length - 1 && <div className="h-3 sm:h-5 bg-red-500"></div>}
          </div>
        ))}
      </div>
    </div>
  );
} 