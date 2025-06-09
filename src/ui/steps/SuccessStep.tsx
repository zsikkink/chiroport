/**
 * SuccessStep Component
 * 
 * Final step showing successful queue entry
 */

import { BodyText } from '@/components/Typography';

export function SuccessStep() {
  return (
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
} 