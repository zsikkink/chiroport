import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { EntrySnapshot, HistoryRow, ServingRow, WaitingRow, WithEntryId } from '../types';
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
    const { data, error } = await supabase
      .from('queues')
      .select('id')
      .eq('location_id', locationId)
      .eq('code', 'default')
      .maybeSingle();

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
    async (options?: { showLoading?: boolean; reason?: string }) => {
      if (!selectedLocationId) return;
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
      onActionError?.('');

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

      if (showLoading) {
        setDataLoading(false);
      }
    },
    [debugEnabled, onActionError, selectedLocationId]
  );

  useEffect(() => {
    if (!selectedLocationId) return;
    loadQueueId(selectedLocationId);
    refreshQueueData({ showLoading: true, reason: 'location-change' });
  }, [selectedLocationId, loadQueueId, refreshQueueData]);

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

  const captureEntrySnapshot = useCallback((entryId: string): EntrySnapshot => {
    const waiting = waitingRef.current.find((row) => row.queue_entry_id === entryId);
    const serving = servingRef.current.find((row) => row.queue_entry_id === entryId);
    const history = historyRef.current.find((row) => row.queue_entry_id === entryId);
    const snapshot: EntrySnapshot = { entryId };
    if (waiting) snapshot.waiting = { ...waiting };
    if (serving) snapshot.serving = { ...serving };
    if (history) snapshot.history = { ...history };
    return snapshot;
  }, []);

  const restoreEntrySnapshot = useCallback((snapshot: EntrySnapshot | null) => {
    if (!snapshot) return;
    if (snapshot.waiting) {
      setWaitingEntries((prev) =>
        sortWaitingEntries(upsertEntry(prev, snapshot.waiting!))
      );
    } else {
      setWaitingEntries((prev) => removeEntry(prev, snapshot.entryId));
    }
    if (snapshot.serving) {
      setServingEntries((prev) =>
        sortServingEntries(upsertEntry(prev, snapshot.serving!))
      );
    } else {
      setServingEntries((prev) => removeEntry(prev, snapshot.entryId));
    }
    if (snapshot.history) {
      setHistoryEntries((prev) =>
        sortHistoryEntries(upsertEntry(prev, snapshot.history!))
      );
    } else {
      setHistoryEntries((prev) => removeEntry(prev, snapshot.entryId));
    }
  }, []);

  const applyOptimisticServing = useCallback(
    (entryId: string) => {
      const snapshot = captureEntrySnapshot(entryId);
      const base = snapshot.waiting ?? snapshot.serving ?? snapshot.history ?? null;
      if (!base) return snapshot;
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
      return snapshot;
    },
    [captureEntrySnapshot]
  );

  const applyOptimisticHistory = useCallback(
    (entryId: string, status: 'completed' | 'cancelled') => {
      const snapshot = captureEntrySnapshot(entryId);
      const base = snapshot.waiting ?? snapshot.serving ?? snapshot.history ?? null;
      if (!base) return snapshot;
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
      return snapshot;
    },
    [captureEntrySnapshot]
  );

  const applyOptimisticWaiting = useCallback(
    (entryId: string) => {
      const snapshot = captureEntrySnapshot(entryId);
      const base = snapshot.waiting ?? snapshot.serving ?? snapshot.history ?? null;
      if (!base) return snapshot;
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
      return snapshot;
    },
    [captureEntrySnapshot]
  );

  const applyOptimisticRemoval = useCallback(
    (entryId: string) => {
      const snapshot = captureEntrySnapshot(entryId);
      setWaitingEntries((prev) => removeEntry(prev, entryId));
      setServingEntries((prev) => removeEntry(prev, entryId));
      setHistoryEntries((prev) => removeEntry(prev, entryId));
      return snapshot;
    },
    [captureEntrySnapshot]
  );

  const applyOptimisticEdit = useCallback(
    (entryId: string, updates: Partial<WaitingRow & ServingRow & HistoryRow>) => {
      const snapshot = captureEntrySnapshot(entryId);
      updateEntryInLists(entryId, updates);
      return snapshot;
    },
    [captureEntrySnapshot, updateEntryInLists]
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
    captureEntrySnapshot,
    restoreEntrySnapshot,
    applyOptimisticServing,
    applyOptimisticHistory,
    applyOptimisticWaiting,
    applyOptimisticRemoval,
    applyOptimisticEdit,
    fetchWaitingEntry,
    fetchServingEntry,
    fetchHistoryEntry,
    entryCounts,
  };
}
