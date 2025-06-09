/**
 * MembershipStep Component
 * 
 * First step asking if user is a Priority Pass or Lounge Key member
 */

import { BodyText } from '@/components/Typography';
import { YesNoButtons } from '@/ui/atoms';

export interface MembershipStepProps {
  onYes: () => void;
  onNo: () => void;
}

export function MembershipStep({ onYes, onNo }: MembershipStepProps) {
  return (
    <div className="space-y-4 py-4">
      <BodyText size="2xl" className="font-medium text-white">
        Priority Pass or Lounge Key member?
      </BodyText>
      <YesNoButtons onYes={onYes} onNo={onNo} selected={null} />
    </div>
  );
} 