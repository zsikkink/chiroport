import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { HistoryRow, ServingRow, WaitingRow, WithEntryId } from '../types';
import {
  formatSupabaseError,
  hasQueueEntryId,
  removeEntry,
  sortHistoryEntries,
  sortServingEntries,
  sortWaitingEntries,
  upsertEntry,
} from '../utils';

const supabase = getSupabaseBrowserClient();

type UseQueueDataOptions = {
  selectedLocationId: string;
  debugEnabled: boolean;
  onActionError?: (message: string) => void;
};

export function useQueueData(options: UseQueueDataOptions) {
  const { selectedLocationId, debugEnabled, onActionError } = options;
  const [queueId, setQueueId] = useState<string | null>(null);
  const [waitingEntries, setWaitingEntries] = useState<WithEntryId<WaitingRow>[]>([]);
  const [servingEntries, setServingEntries] = useState<WithEntryId<ServingRow>[]>([]);
  const [historyEntries, setHistoryEntries] = useState<WithEntryId<HistoryRow>[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const refreshCountRef = useRef(0);
  const locationRef = useRef(selectedLocationId);
  const requestRef = useRef(0);
  const queueRequestRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshPendingRef = useRef(false);

  const waitingRef = useRef(waitingEntries);
  const servingRef = useRef(servingEntries);
  const historyRef = useRef(historyEntries);

  useEffect(() => {
    waitingRef.current = waitingEntries;
  }, [waitingEntries]);

  useEffect(() => {
    servingRef.current = servingEntries;
  }, [servingEntries]);

  useEffect(() => {
    historyRef.current = historyEntries;
  }, [historyEntries]);

  const loadQueueId = useCallback(async (locationId: string) => {
    const request = ++queueRequestRef.current;
    const { data, error } = await supabase
      .from('queues')
      .select('id')
      .eq('location_id', locationId)
      .eq('code', 'default')
      .maybeSingle();

    if (request !== queueRequestRef.current || locationId !== locationRef.current) return;

    if (error) {
      const message = formatSupabaseError(error, 'Failed to load queue.');
      console.error('[employee] loadQueueId failed', { error, locationId });
      onActionError?.(message);
      setQueueId(null);
      return;
    }

    setQueueId(data?.id ?? null);
  }, [onActionError]);

  const refreshQueueData = useCallback(
    (options?: { showLoading?: boolean; reason?: string; clearActionError?: boolean }) => {
      if (!selectedLocationId || selectedLocationId !== locationRef.current) return Promise.resolve();
      const showLoading = options?.showLoading ?? false;
      refreshCountRef.current += 1;
      if (debugEnabled) {
        console.debug('[employee] refreshQueueData', {
          count: refreshCountRef.current,
          locationId: selectedLocationId,
          reason: options?.reason ?? 'auto',
          showLoading,
        });
      }
      if (showLoading) {
        setDataLoading(true);
      }
      // Background refreshes must not dismiss a rejected staff action.
      if (options?.clearActionError === true) onActionError?.('');
      if (refreshInFlightRef.current) {
        refreshPendingRef.current = true;
        return refreshInFlightRef.current;
      }
      const request = ++requestRef.current;
      const load = async () => {
        do {
          refreshPendingRef.current = false;

          const [waiting, serving, history] = await Promise.all([
            supabase
              .from('employee_queue_waiting_view')
              .select('*')
              .eq('location_id', selectedLocationId)
              .order('queue_position', { ascending: true }),
            supabase
              .from('employee_queue_serving_view')
              .select('*')
              .eq('location_id', selectedLocationId)
              .order('created_at', { ascending: true }),
            supabase
              .from('employee_queue_history_view')
              .select('*')
              .eq('location_id', selectedLocationId)
              .order('end_ts', { ascending: false }),
          ]);

          if (request !== requestRef.current || selectedLocationId !== locationRef.current) return;

          if (waiting.error || serving.error || history.error) {
            const rootError = waiting.error || serving.error || history.error;
            const message = formatSupabaseError(rootError, 'Failed to load queue data.');
            console.error('[employee] refreshQueueData failed', {
              waitingError: waiting.error,
              servingError: serving.error,
              historyError: history.error,
              locationId: selectedLocationId,
            });
            onActionError?.(message);
          } else {
            const waitingRows = (waiting.data ?? []).filter(hasQueueEntryId);
            const servingRows = (serving.data ?? []).filter(hasQueueEntryId);
            const historyRows = (history.data ?? []).filter(hasQueueEntryId);

            setWaitingEntries(sortWaitingEntries(waitingRows));
            setServingEntries(sortServingEntries(servingRows));
            setHistoryEntries(sortHistoryEntries(historyRows));
          }

          setDataLoading(false);
        } while (refreshPendingRef.current && request === requestRef.current && selectedLocationId === locationRef.current);
      };
      const inFlight = load().catch(() => {
        if (request === requestRef.current && selectedLocationId === locationRef.current) {
          onActionError?.('Failed to load queue data. Please retry.');
          setDataLoading(false);
        }
      }).finally(() => {
        if (refreshInFlightRef.current === inFlight) refreshInFlightRef.current = null;
      });
      refreshInFlightRef.current = inFlight;
      return inFlight;
    },
    [debugEnabled, onActionError, selectedLocationId]
  );

  useEffect(() => {
    locationRef.current = selectedLocationId;
    setQueueId(null);
    setWaitingEntries([]);
    setServingEntries([]);
    setHistoryEntries([]);
    setDataLoading(Boolean(selectedLocationId));
    if (selectedLocationId) {
      void loadQueueId(selectedLocationId);
      void refreshQueueData({ showLoading: true, reason: 'location-change', clearActionError: true });
    }
    return () => {
      locationRef.current = '';
      refreshInFlightRef.current = null;
      refreshPendingRef.current = false;
      requestRef.current += 1;
      queueRequestRef.current += 1;
    };
  }, [selectedLocationId, loadQueueId, refreshQueueData]);

  useEffect(() => {
    if (!selectedLocationId) return;
    const recover = () => {
      if (document.visibilityState !== 'visible') return;
      if (!queueId) void loadQueueId(selectedLocationId);
      void refreshQueueData({ showLoading: false, reason: 'browser-recovery' });
    };
    // Realtime can remain disconnected or miss a move/delete. A visible staff
    // workspace must eventually converge even without a websocket recovery.
    const interval = window.setInterval(recover, 60_000);
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [selectedLocationId, queueId, loadQueueId, refreshQueueData]);

  const updateEntryInLists = useCallback(
    (entryId: string, updates: Partial<WaitingRow & ServingRow & HistoryRow>) => {
      setWaitingEntries((prev) => {
        const index = prev.findIndex((row) => row.queue_entry_id === entryId);
        if (index === -1) return prev;
        const updated = prev.slice();
        updated[index] = { ...updated[index], ...updates } as (typeof updated)[number];
        return sortWaitingEntries(updated);
      });
      setServingEntries((prev) => {
        const index = prev.findIndex((row) => row.queue_entry_id === entryId);
        if (index === -1) return prev;
        const updated = prev.slice();
        updated[index] = { ...updated[index], ...updates } as (typeof updated)[number];
        return sortServingEntries(updated);
      });
      setHistoryEntries((prev) => {
        const index = prev.findIndex((row) => row.queue_entry_id === entryId);
        if (index === -1) return prev;
        const updated = prev.slice();
        updated[index] = { ...updated[index], ...updates } as (typeof updated)[number];
        return sortHistoryEntries(updated);
      });
    },
    []
  );

  const removeEntryFromLists = useCallback((entryId: string) => {
    setWaitingEntries((prev) => removeEntry(prev, entryId));
    setServingEntries((prev) => removeEntry(prev, entryId));
    setHistoryEntries((prev) => removeEntry(prev, entryId));
  }, []);

  const findEntry = useCallback((entryId: string) => {
    return (
      waitingRef.current.find((row) => row.queue_entry_id === entryId) ??
      servingRef.current.find((row) => row.queue_entry_id === entryId) ??
      historyRef.current.find((row) => row.queue_entry_id === entryId) ??
      null
    );
  }, []);

  const applyOptimisticServing = useCallback(
    (entryId: string) => {
      const base = findEntry(entryId);
      if (!base) return;
      const nowIso = new Date().toISOString();
      const servingEntry = {
        ...(base as ServingRow),
        status: 'serving',
        served_at: nowIso,
        updated_at: nowIso,
      } as WithEntryId<ServingRow>;
      setServingEntries((prev) =>
        sortServingEntries(upsertEntry(prev, servingEntry))
      );
      setWaitingEntries((prev) => removeEntry(prev, entryId));
      setHistoryEntries((prev) => removeEntry(prev, entryId));
    },
    [findEntry]
  );

  const applyOptimisticHistory = useCallback(
    (entryId: string, status: 'completed' | 'cancelled') => {
      const base = findEntry(entryId);
      if (!base) return;
      const nowIso = new Date().toISOString();
      const historyEntry = {
        ...(base as HistoryRow),
        status,
        end_ts: nowIso,
        updated_at: nowIso,
      } as WithEntryId<HistoryRow>;
      setHistoryEntries((prev) =>
        sortHistoryEntries(upsertEntry(prev, historyEntry))
      );
      setWaitingEntries((prev) => removeEntry(prev, entryId));
      setServingEntries((prev) => removeEntry(prev, entryId));
    },
    [findEntry]
  );

  const applyOptimisticWaiting = useCallback(
    (entryId: string) => {
      const base = findEntry(entryId);
      if (!base) return;
      const nowIso = new Date().toISOString();
      const waitingEntry = {
        ...(base as WaitingRow),
        status: 'waiting',
        updated_at: nowIso,
      } as WithEntryId<WaitingRow>;
      setWaitingEntries((prev) =>
        sortWaitingEntries(upsertEntry(prev, waitingEntry))
      );
      setServingEntries((prev) => removeEntry(prev, entryId));
      setHistoryEntries((prev) => removeEntry(prev, entryId));
    },
    [findEntry]
  );

  const applyOptimisticRemoval = useCallback(
    (entryId: string) => {
      if (!findEntry(entryId)) return;
      setWaitingEntries((prev) => removeEntry(prev, entryId));
      setServingEntries((prev) => removeEntry(prev, entryId));
      setHistoryEntries((prev) => removeEntry(prev, entryId));
    },
    [findEntry]
  );

  const fetchWaitingEntry = useCallback(async (entryId: string) => {
    const { data } = await supabase
      .from('employee_queue_waiting_view')
      .select('*')
      .eq('queue_entry_id', entryId)
      .maybeSingle();
    return data && hasQueueEntryId(data) ? data : null;
  }, []);

  const fetchServingEntry = useCallback(async (entryId: string) => {
    const { data } = await supabase
      .from('employee_queue_serving_view')
      .select('*')
      .eq('queue_entry_id', entryId)
      .maybeSingle();
    return data && hasQueueEntryId(data) ? data : null;
  }, []);

  const fetchHistoryEntry = useCallback(async (entryId: string) => {
    const { data } = await supabase
      .from('employee_queue_history_view')
      .select('*')
      .eq('queue_entry_id', entryId)
      .maybeSingle();
    return data && hasQueueEntryId(data) ? data : null;
  }, []);

  const entryCounts = useMemo(() => ({
    waiting: waitingEntries.length,
    serving: servingEntries.length,
    history: historyEntries.length,
  }), [waitingEntries.length, servingEntries.length, historyEntries.length]);

  return {
    queueId,
    waitingEntries,
    servingEntries,
    historyEntries,
    dataLoading,
    refreshQueueData,
    setWaitingEntries,
    setServingEntries,
    setHistoryEntries,
    waitingRef,
    servingRef,
    historyRef,
    updateEntryInLists,
    removeEntryFromLists,
    applyOptimisticServing,
    applyOptimisticHistory,
    applyOptimisticWaiting,
    applyOptimisticRemoval,
    fetchWaitingEntry,
    fetchServingEntry,
    fetchHistoryEntry,
    entryCounts,
  };
}
