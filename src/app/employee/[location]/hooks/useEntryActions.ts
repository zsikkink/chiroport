import { useCallback, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  CreateFormState,
  EntrySnapshot,
  HistoryRow,
  LocationOption,
  ServingRow,
  WaitingRow,
  WithEntryId,
} from '../types';
import { resolveActionError, sortHistoryEntries, sortWaitingEntries } from '../utils';

const supabase = getSupabaseBrowserClient();

type QueueState = {
  applyOptimisticServing: (entryId: string) => EntrySnapshot | null;
  applyOptimisticHistory: (entryId: string, status: 'completed' | 'cancelled') => EntrySnapshot | null;
  applyOptimisticWaiting: (entryId: string) => EntrySnapshot | null;
  applyOptimisticRemoval: (entryId: string) => EntrySnapshot | null;
  applyOptimisticEdit: (entryId: string, updates: Partial<WaitingRow & ServingRow & HistoryRow>) => EntrySnapshot | null;
  restoreEntrySnapshot: (snapshot: EntrySnapshot | null) => void;
  removeEntryFromLists: (entryId: string) => void;
  fetchWaitingEntry: (entryId: string) => Promise<WithEntryId<WaitingRow> | null>;
  fetchHistoryEntry: (entryId: string) => Promise<WithEntryId<HistoryRow> | null>;
  refreshQueueData: (options?: { showLoading?: boolean; reason?: string }) => Promise<void>;
  setWaitingEntries: React.Dispatch<React.SetStateAction<WithEntryId<WaitingRow>[]>>;
  setHistoryEntries: React.Dispatch<React.SetStateAction<WithEntryId<HistoryRow>[]>>;
};

type UseEntryActionsOptions = {
  currentUserId: string | null;
  queueId: string | null;
  selectedLocationId: string;
  setActionError: (message: string) => void;
  queueState: QueueState;
  invokeEmployeeFunction: (name: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getFunctionHeaders: () => Promise<Record<string, string>>;
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
    serviceLabel: string;
    customerType: 'paying' | 'priority_pass';
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
    getFunctionHeaders,
  } = options;
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runAction = useCallback(
    async (
      key: string,
      action: () => Promise<void>,
      context?: Record<string, unknown>
    ) => {
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
      optimistic: () => EntrySnapshot | null,
      action: () => Promise<void>,
      context?: Record<string, unknown>
    ) => {
      const snapshot = optimistic();
      const success = await runAction(key, action, context);
      if (!success) {
        queueState.restoreEntrySnapshot(snapshot);
      }
      return success;
    },
    [queueState, runAction]
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
    async (entryId: string) => {
      await runOptimisticAction(
        `cancel:${entryId}`,
        () => queueState.applyOptimisticHistory(entryId, 'cancelled'),
        async () => {
          await callQueueEntryAction('cancel', entryId);
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

      const consentKey =
        form.serviceLabel === 'Chiropractor'
          ? 'queue_join_consent_chiropractic'
          : 'queue_join_consent_bodywork';

      const success = await runAction(
        'create-entry',
        async () => {
          const headers = await getFunctionHeaders();
          const { data, error } = await supabase.functions.invoke('queue_join', {
            body: {
              airportCode: selectedLocation.airport_code,
              locationCode: selectedLocation.code,
              name: form.fullName.trim(),
              phone: form.phone.trim(),
              email: form.email.trim(),
              consent: true,
              customerType: form.customerType,
              serviceLabel: form.serviceLabel,
              consentKey,
            },
            headers,
          });

          if (error) throw error;
          const parsed =
            typeof data === 'string'
              ? (JSON.parse(data) as Record<string, unknown>)
              : data;
          if (!parsed || (parsed as { error?: string }).error) {
            throw new Error(
              (parsed as { error?: string })?.error || 'Failed to create entry'
            );
          }
          const entryId = (parsed as { queueEntryId?: string }).queueEntryId;
          if (!entryId) {
            throw new Error('Queue entry was not created.');
          }

          const row = await queueState.fetchWaitingEntry(entryId);
          if (row) {
            queueState.setWaitingEntries((prev) =>
              sortWaitingEntries([...prev, row])
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
      getFunctionHeaders,
      queueState,
      runAction,
      setActionError,
    ]
  );

  const handleEditSubmit = useCallback(
    async ({ entryId, form }: EditEntryArgs) => {
      const optimisticUpdates = {
        full_name: form.fullName.trim() || null,
        email: form.email.trim().toLowerCase() || null,
        phone_e164: form.phone.trim() || null,
        service_label: form.serviceLabel,
        customer_type: form.customerType,
      };
      const success = await runOptimisticAction(
        `edit:${entryId}`,
        () => queueState.applyOptimisticEdit(entryId, optimisticUpdates),
        async () => {
          await invokeEmployeeFunction('update_queue_entry', {
            queueEntryId: entryId,
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            serviceLabel: form.serviceLabel,
            customerType: form.customerType,
          });
        },
        { entryId }
      );

      if (success) {
        const updated = await queueState.fetchHistoryEntry(entryId);
        if (updated) {
          queueState.setHistoryEntries((prev) =>
            sortHistoryEntries([
              ...prev.filter((row) => row.queue_entry_id !== entryId),
              updated,
            ])
          );
        }
      }
      return success;
    },
    [invokeEmployeeFunction, queueState, runOptimisticAction]
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
