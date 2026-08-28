'use client';

import { BodyText } from '@/components/ui';
import type { WizardState } from '@/features/location-details/types';

export const SuccessStep = ({
  submissionSuccess,
}: {
  submissionSuccess: WizardState['submissionSuccess'];
}) => {
  const queuePosition = submissionSuccess?.queuePosition ?? null;
  const alreadyInQueue = submissionSuccess?.alreadyInQueue ?? false;

  return (
    <div className="space-y-6 py-4 text-center">
      <div className="mb-6">
        <BodyText size="3xl" className="font-bold text-slate-800 mb-4">
          🎉 You&apos;re in the queue! 🎉
        </BodyText>
        {alreadyInQueue ? (
          <BodyText size="lg" className="text-slate-600">
            You were already in line, so we kept your place.
          </BodyText>
        ) : null}
      </div>

      <div className="space-y-4">
        {queuePosition !== null ? (
          <BodyText size="xl" className="text-slate-800">
            Your current position: {queuePosition}
          </BodyText>
        ) : null}
        <BodyText size="xl" className="text-slate-800">
          We&apos;ll text you when you&apos;re up next.
        </BodyText>
        <BodyText size="xl" className="text-slate-800 break-keep">
          If you enjoy your experience, a gratuity is greatly appreciated!
        </BodyText>
      </div>
    </div>
  );
};
