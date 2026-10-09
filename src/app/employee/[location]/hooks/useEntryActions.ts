import { useCallback, useState } from 'react';
import type { OfferingCode } from '@/domain/services/catalog';
import type {
  CreateFormState,
  LocationOption,
  WaitingRow,
  WithEntryId,
} from '../types';
import { resolveActionError, sortWaitingEntries, upsertEntry } from '../utils';

type QueueState = {
  applyOptimisticServing: (entryId: string) => void;
  applyOptimisticHistory: (entryId: string, status: 'completed' | 'cancelled') => void;
  applyOptimisticWaiting: (entryId: string) => void;
  applyOptimisticRemoval: (entryId: string) => void;
  removeEntryFromLists: (entryId: string) => void;
  fetchWaitingEntry: (entryId: string) => Promise<WithEntryId<WaitingRow> | null>;
  refreshQueueData: (options?: { showLoading?: boolean; reason?: string }) => Promise<void>;
  setWaitingEntries: React.Dispatch<React.SetStateAction<WithEntryId<WaitingRow>[]>>;
};

type UseEntryActionsOptions = {
  currentUserId: string | null;
  queueId: string | null;
  selectedLocationId: string;
  setActionError: (message: string) => void;
  queueState: QueueState;
  invokeEmployeeFunction: (name: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type CreateEntryArgs = {
  form: CreateFormState;
  selectedLocation: LocationOption | null;
};

type EditEntryArgs = {
  entryId: string;
  form: {
    fullName: string;
    email: string;
    phone: string;
    offeringCode: OfferingCode;
  };
};

type MoveEntryArgs = {
  entryId: string;
  targetLocationId: string;
};

export function useEntryActions(options: UseEntryActionsOptions) {
  const {
    currentUserId,
    queueId,
    selectedLocationId,
    setActionError,
    queueState,
    invokeEmployeeFunction,
  } = options;
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runAction = useCallback(
    async (
      key: string,
      action: () => Promise<void>,
      context?: Record<string, unknown>
    ) => {
      if (!queueId) return false;
      let success = false;
      setBusyAction(key);
      setActionError('');
      console.info('[employee] action start', {
        action: key,
        userId: currentUserId,
        queueId,
        locationId: selectedLocationId,
        ...context,
      });
      try {
        await action();
        console.info('[employee] action success', { action: key });
        success = true;
      } catch (error) {
        const message = await resolveActionError(
          error,
          'Action failed. Please try again.'
        );
        console.error('[employee] action failed', {
          action: key,
          error,
          message,
          context,
        });
        setActionError(message);
      } finally {
        setBusyAction(null);
      }
      return success;
    },
    [currentUserId, queueId, selectedLocationId, setActionError]
  );

  const runOptimisticAction = useCallback(
    async (
      key: string,
      optimistic: () => void,
      action: () => Promise<void>,
      context?: Record<string, unknown>
    ) => {
      if (!queueId) return false;
      optimistic();
      const success = await runAction(key, action, context);
      if (!success) {
        await queueState.refreshQueueData({
          showLoading: false,
          reason: `reconcile-failed-${key}`,
        });
      }
      return success;
    },
    [queueId, queueState, runAction]
  );

  const callQueueEntryAction = useCallback(
    async (action: string, entryId: string, extra?: Record<string, unknown>) => {
      await invokeEmployeeFunction('queue_entry_action', {
        action,
        queueEntryId: entryId,
        ...extra,
      });
    },
    [invokeEmployeeFunction]
  );

  const handleSetServing = useCallback(
    async (entryId: string) => {
      await runOptimisticAction(
        `serving:${entryId}`,
        () => queueState.applyOptimisticServing(entryId),
        async () => {
          await callQueueEntryAction('serving', entryId);
        },
        { entryId }
      );
    },
    [callQueueEntryAction, queueState, runOptimisticAction]
  );

  const handleComplete = useCallback(
    async (entryId: string) => {
      await runOptimisticAction(
        `complete:${entryId}`,
        () => queueState.applyOptimisticHistory(entryId, 'completed'),
        async () => {
          await callQueueEntryAction('complete', entryId);
        },
        { entryId }
      );
    },
    [callQueueEntryAction, queueState, runOptimisticAction]
  );

  const handleCancel = useCallback(
    async (entryId: string, departureReason: string | null) => {
      await runOptimisticAction(
        `cancel:${entryId}`,
        () => queueState.applyOptimisticHistory(entryId, 'cancelled'),
        async () => {
          await callQueueEntryAction('cancel', entryId, {
            departureReason,
          });
        },
        { entryId }
      );
    },
    [callQueueEntryAction, queueState, runOptimisticAction]
  );

  const handleReturnToQueue = useCallback(
    async (entryId: string) => {
      await runOptimisticAction(
        `return:${entryId}`,
        () => queueState.applyOptimisticWaiting(entryId),
        async () => {
          await callQueueEntryAction('return', entryId);
        },
        { entryId }
      );
    },
    [callQueueEntryAction, queueState, runOptimisticAction]
  );

  const handleDelete = useCallback(
    async (entryId: string, onDeleted?: () => void) => {
      const confirmed = window.confirm(
        'Delete this queue entry? This cannot be undone.'
      );
      if (!confirmed) return;

      await runOptimisticAction(
        `delete:${entryId}`,
        () => queueState.applyOptimisticRemoval(entryId),
        async () => {
          await callQueueEntryAction('delete', entryId);
          queueState.removeEntryFromLists(entryId);
          onDeleted?.();
        },
        { entryId }
      );
    },
    [callQueueEntryAction, queueState, runOptimisticAction]
  );

  const handleMoveSubmit = useCallback(
    async ({ entryId, targetLocationId }: MoveEntryArgs) => {
      if (!targetLocationId) {
        setActionError('Select a target location.');
        return false;
      }

      const success = await runOptimisticAction(
        `move:${entryId}`,
        () => queueState.applyOptimisticRemoval(entryId),
        async () => {
          await callQueueEntryAction('move', entryId, {
            targetLocationId,
          });
        },
        { entryId, targetLocationId }
      );

      if (success) {
        queueState.removeEntryFromLists(entryId);
      }
      return success;
    },
    [callQueueEntryAction, queueState, runOptimisticAction, setActionError]
  );

  const handleCreateSubmit = useCallback(
    async ({ form, selectedLocation }: CreateEntryArgs) => {
      if (!selectedLocation) {
        setActionError('Select a location.');
        return false;
      }
      if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
        setActionError('Name, email, and phone are required.');
        return false;
      }
      if (!form.consent) {
        setActionError('Consent is required.');
        return false;
      }

      const success = await runAction(
        'create-entry',
        async () => {
          const parsed = await invokeEmployeeFunction('queue_join', {
            airportCode: selectedLocation.airport_code,
            locationCode: selectedLocation.code,
            name: form.fullName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            consent: true,
            offeringCode: form.offeringCode,
          });
          if (!parsed) throw new Error('Failed to create entry');
          const entryId = (parsed as { queueEntryId?: string }).queueEntryId;
          if (!entryId) {
            throw new Error('Queue entry was not created.');
          }

          const row = await queueState.fetchWaitingEntry(entryId);
          if (row) {
            queueState.setWaitingEntries((prev) =>
              sortWaitingEntries(upsertEntry(prev, row))
            );
          } else {
            await queueState.refreshQueueData({
              showLoading: false,
              reason: 'create-entry',
            });
          }
        },
        { locationId: selectedLocation.id }
      );

      return success;
    },
    [
      invokeEmployeeFunction,
      queueState,
      runAction,
      setActionError,
    ]
  );

  const handleEditSubmit = useCallback(
    async ({ entryId, form }: EditEntryArgs) => {
      const success = await runAction(
        `edit:${entryId}`,
        async () => {
          await invokeEmployeeFunction('update_queue_entry', {
            queueEntryId: entryId,
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            offeringCode: form.offeringCode,
          });
        },
        { entryId }
      );

      if (success) {
        await queueState.refreshQueueData({
          showLoading: false,
          reason: 'edit-entry',
        });
      }
      return success;
    },
    [invokeEmployeeFunction, queueState, runAction]
  );

  return {
    busyAction,
    runAction,
    runOptimisticAction,
    handleSetServing,
    handleComplete,
    handleCancel,
    handleReturnToQueue,
    handleDelete,
    handleMoveSubmit,
    handleCreateSubmit,
    handleEditSubmit,
  };
}
