'use client';

import { useState } from 'react';
import { BodyText } from '@/components/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { WizardState } from '@/features/location-details/types';

export const SuccessStep = ({
  submissionSuccess,
  isPriorityPass,
}: {
  submissionSuccess: WizardState['submissionSuccess'];
  isPriorityPass: boolean;
}) => {
  const queuePosition = submissionSuccess?.queuePosition ?? null;
  const alreadyInQueue = submissionSuccess?.alreadyInQueue ?? false;
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [departureReason, setDepartureReason] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [leftQueue, setLeftQueue] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  const leaveQueue = async () => {
    if (!submissionSuccess?.publicToken || !departureReason || leaving) return;
    setLeaving(true);
    setLeaveError('');
    const { error } = await getSupabaseBrowserClient().rpc('cancel_visit_with_reason', {
      p_public_token: submissionSuccess.publicToken,
      p_departure_reason: departureReason,
    });
    if (error) {
      setLeaveError('We could not remove you from the queue. Please try again or text CANCEL.');
      setLeaving(false);
      return;
    }
    setLeftQueue(true);
    setLeaving(false);
  };

  if (leftQueue) {
    return (
      <div className="space-y-3 py-4 text-center">
        <BodyText size="xl" className="font-bold text-slate-800">You left the queue.</BodyText>
        <BodyText size="lg" className="text-slate-600">Thanks for letting us know why.</BodyText>
      </div>
    );
  }

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
      <div className="border-t border-slate-200 pt-5">
        {showLeaveForm ? (
          <div className="space-y-3 text-left">
            <label className="block text-sm font-medium text-slate-800">
              Why are you leaving the queue?
              <select
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                value={departureReason}
                onChange={(event) => setDepartureReason(event.target.value)}
              >
                <option value="">Choose a reason</option>
                <option value="wait_too_long">Wait is too long</option>
                <option value="no_staff_available">No staff available</option>
                <option value="plans_changed">Plans changed</option>
                {isPriorityPass ? (
                  <option value="priority_pass_declined">Priority Pass was declined</option>
                ) : null}
                <option value="other">Other</option>
              </select>
            </label>
            {leaveError ? <p className="text-sm text-red-700">{leaveError}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!departureReason || leaving}
                onClick={() => void leaveQueue()}
              >
                {leaving ? 'Leaving...' : 'Confirm leaving queue'}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setShowLeaveForm(false)}
              >
                Stay in queue
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-slate-600 underline underline-offset-2"
            onClick={() => setShowLeaveForm(true)}
          >
            Leave queue
          </button>
        )}
      </div>
    </div>
  );
};
