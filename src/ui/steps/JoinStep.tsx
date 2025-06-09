/**
 * JoinStep Component
 * 
 * Step for Priority Pass members to optionally add spinal adjustments
 */

import { BodyText } from '@/components/Typography';
import { BackButton, AnimatedButton } from '@/ui/atoms';

export interface JoinStepProps {
  onSetSpinal: (value: boolean) => void;
  onBack: () => void;
}

export function JoinStep({ onSetSpinal, onBack }: JoinStepProps) {
  return (
    <div className="py-4">
      <BackButton onClick={onBack} />
      <BodyText size="2xl" className="font-medium text-white mt-4">
        The Priority Pass & Lounge Key service includes stretching, muscle work, and massage.
      </BodyText>
      <div className="space-y-3 mt-12">
        <BodyText size="2xl" className="text-white">
          Would you like to add spinal & neck adjustments for just $35  — a 50% Discount!
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
} 