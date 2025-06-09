/**
 * NonMemberStep Component
 * 
 * Step for non-members with options to join queue or schedule future treatment
 */

import { BackButton, AnimatedButton } from '@/ui/atoms';

export interface NonMemberStepProps {
  onProceed: () => void;
  onSchedule: () => void;
  onBack: () => void;
}

export function NonMemberStep({ onProceed, onSchedule, onBack }: NonMemberStepProps) {
  return (
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
} 