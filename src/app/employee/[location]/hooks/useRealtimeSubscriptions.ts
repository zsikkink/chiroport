import { useCallback, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import type { ChatEntry, ChatMessage, HistoryRow, ServingRow, WaitingRow, WithEntryId } from '../types';
import {
  removeEntry,
  sortHistoryEntries,
  sortServingEntries,
  sortWaitingEntries,
  toEpoch,
  upsertEntry,
} from '../utils';

const supabase = getSupabaseBrowserClient();

type QueueState = {
  queueId: string | null;
  debugEnabled: boolean;
  waitingRef: React.MutableRefObject<WithEntryId<WaitingRow>[]>;
  servingRef: React.MutableRefObject<WithEntryId<ServingRow>[]>;
  historyRef: React.MutableRefObject<WithEntryId<HistoryRow>[]>;
  setWaitingEntries: React.Dispatch<React.SetStateAction<WithEntryId<WaitingRow>[]>>;
  setServingEntries: React.Dispatch<React.SetStateAction<WithEntryId<ServingRow>[]>>;
  setHistoryEntries: React.Dispatch<React.SetStateAction<WithEntryId<HistoryRow>[]>>;
  updateEntryInLists: (entryId: string, updates: Partial<WaitingRow & ServingRow & HistoryRow>) => void;
  removeEntryFromLists: (entryId: string) => void;
  fetchWaitingEntry: (entryId: string) => Promise<WithEntryId<WaitingRow> | null>;
  fetchServingEntry: (entryId: string) => Promise<WithEntryId<ServingRow> | null>;
  fetchHistoryEntry: (entryId: string) => Promise<WithEntryId<HistoryRow> | null>;
};

type ChatState = {
  chatEntryRef: React.MutableRefObject<ChatEntry | null>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setUnreadEntryIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

export function useRealtimeSubscriptions(queueState: QueueState, chatState: ChatState) {
  const {
    queueId,
    debugEnabled,
    waitingRef,
    servingRef,
    historyRef,
    setWaitingEntries,
    setServingEntries,
    setHistoryEntries,
    updateEntryInLists,
    removeEntryFromLists,
    fetchWaitingEntry,
    fetchServingEntry,
    fetchHistoryEntry,
  } = queueState;
  const { chatEntryRef, setChatMessages, setUnreadEntryIds } = chatState;

  const queueSubCountRef = useRef(0);
  const smsSubCountRef = useRef(0);

  const handleQueueEntryChange = useCallback(
    async (payload: {
      eventType: string;
      new?: Record<string, unknown>;
      old?: Record<string, unknown>;
    }) => {
      const record = (payload.eventType === 'DELETE'
        ? payload.old
        : payload.new) as Database['public']['Tables']['queue_entries']['Row'] | undefined;
      if (!record) return;
      const entryId = record.id;
      if (debugEnabled) {
        console.debug('[employee] queue_entries event', {
          eventType: payload.eventType,
          entryId,
          status: record.status,
        });
      }

      if (payload.eventType === 'DELETE') {
        removeEntryFromLists(entryId);
        return;
      }

      if (record.status === 'waiting') {
        const existing = waitingRef.current.find(
          (row) => row.queue_entry_id === entryId
        );
        if (existing) {
          updateEntryInLists(entryId, {
            status: record.status,
            sort_key: record.sort_key ?? existing.sort_key,
            updated_at: record.updated_at ?? existing.updated_at,
          });
        } else {
          const row = await fetchWaitingEntry(entryId);
          if (row) {
            setWaitingEntries((prev) => sortWaitingEntries(upsertEntry(prev, row)));
          }
        }
        setServingEntries((prev) => removeEntry(prev, entryId));
        setHistoryEntries((prev) => removeEntry(prev, entryId));
        return;
      }

      if (record.status === 'serving') {
        const existing = servingRef.current.find(
          (row) => row.queue_entry_id === entryId
        );
        if (existing) {
          updateEntryInLists(entryId, {
            status: record.status,
            updated_at: record.updated_at ?? existing.updated_at,
          });
        } else {
          const row = await fetchServingEntry(entryId);
          if (row) {
            setServingEntries((prev) => sortServingEntries(upsertEntry(prev, row)));
          }
        }
        setWaitingEntries((prev) => removeEntry(prev, entryId));
        setHistoryEntries((prev) => removeEntry(prev, entryId));
        return;
      }

      if (['completed', 'cancelled', 'no_show'].includes(record.status ?? '')) {
        const existing = historyRef.current.find(
          (row) => row.queue_entry_id === entryId
        );
        if (existing) {
          const endTs =
            record.completed_at ??
            record.cancelled_at ??
            record.no_show_at ??
            record.served_at ??
            record.updated_at ??
            record.created_at ??
            existing.end_ts;
          updateEntryInLists(entryId, {
            status: record.status,
            end_ts: endTs,
            updated_at: record.updated_at ?? existing.updated_at,
          });
        } else {
          const row = await fetchHistoryEntry(entryId);
          if (row) {
            setHistoryEntries((prev) => sortHistoryEntries(upsertEntry(prev, row)));
          }
        }
        setWaitingEntries((prev) => removeEntry(prev, entryId));
        setServingEntries((prev) => removeEntry(prev, entryId));
      }
    },
    [
      debugEnabled,
      fetchHistoryEntry,
      fetchServingEntry,
      fetchWaitingEntry,
      historyRef,
      removeEntryFromLists,
      servingRef,
      setHistoryEntries,
      setServingEntries,
      setWaitingEntries,
      updateEntryInLists,
      waitingRef,
    ]
  );

  useEffect(() => {
    if (!queueId) return;
    queueSubCountRef.current += 1;
    if (debugEnabled) {
      console.debug('[employee] subscribe queue_entries', {
        count: queueSubCountRef.current,
        queueId,
      });
    }
    const channel = supabase
      .channel(`queue_entries_${queueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          filter: `queue_id=eq.${queueId}`,
        },
        (payload) => {
          void handleQueueEntryChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queueId, debugEnabled, handleQueueEntryChange]);

  useEffect(() => {
    smsSubCountRef.current += 1;
    if (debugEnabled) {
      console.debug('[employee] subscribe sms channels', {
        count: smsSubCountRef.current,
      });
    }
    const inboundChannel = supabase
      .channel('sms_inbound_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_inbound',
        },
        (payload) => {
          const row = payload.new as {
            from_phone?: string;
            body?: string;
            received_at?: string;
            id?: string;
          };
          if (!row?.from_phone || !row.received_at) return;
          const receivedAt = row.received_at;
          const fromPhone = row.from_phone;
          const body = row.body ?? '';

          const shouldUpdate = (entry: {
            phone_e164: string | null;
            created_at?: string | null;
            last_inbound_at?: string | null;
          }) => {
            if (!entry.phone_e164 || entry.phone_e164 !== fromPhone) return false;
            if (entry.created_at && toEpoch(receivedAt) < toEpoch(entry.created_at)) {
              return false;
            }
            if (entry.last_inbound_at && toEpoch(receivedAt) <= toEpoch(entry.last_inbound_at)) {
              return false;
            }
            return true;
          };

          const updateInbound = <
            T extends {
              queue_entry_id: string;
              phone_e164: string | null;
              created_at?: string | null;
              last_inbound_at?: string | null;
              last_inbound_body?: string | null;
            }
          >(
            rows: T[]
          ) => {
            let updated = rows;
            const updatedEntryIds = new Set<string>();
            rows.forEach((entry, index) => {
              if (!shouldUpdate(entry)) return;
              updatedEntryIds.add(entry.queue_entry_id);
              if (updated === rows) {
                updated = rows.slice();
              }
              updated[index] = {
                ...entry,
                last_inbound_body: body,
                last_inbound_at: receivedAt,
              };
            });
            return { rows: updated, updatedEntryIds };
          };

          const waitingUpdate = updateInbound(waitingRef.current);
          const servingUpdate = updateInbound(servingRef.current);
          const historyUpdate = updateInbound(historyRef.current);
          const updatedEntryIds = new Set<string>([
            ...waitingUpdate.updatedEntryIds,
            ...servingUpdate.updatedEntryIds,
            ...historyUpdate.updatedEntryIds,
          ]);

          if (waitingUpdate.rows !== waitingRef.current) {
            setWaitingEntries(sortWaitingEntries(waitingUpdate.rows));
          }
          if (servingUpdate.rows !== servingRef.current) {
            setServingEntries(sortServingEntries(servingUpdate.rows));
          }
          if (historyUpdate.rows !== historyRef.current) {
            setHistoryEntries(sortHistoryEntries(historyUpdate.rows));
          }

          const activeChat = chatEntryRef.current;
          if (updatedEntryIds.size > 0) {
            const activeId = activeChat?.queue_entry_id ?? null;
            setUnreadEntryIds((prev) => {
              const next = { ...prev };
              updatedEntryIds.forEach((entryId) => {
                if (activeId && entryId === activeId) {
                  delete next[entryId];
                  return;
                }
                next[entryId] = true;
              });
              return next;
            });
          }
          if (activeChat?.phone_e164 === fromPhone) {
            setChatMessages((prev) => [
              ...prev,
              {
                id: `inbound:${row.id ?? receivedAt}`,
                direction: 'in',
                body,
                at: receivedAt,
              },
            ]);
          }
        }
      )
      .subscribe();

    const outboxChannel = supabase
      .channel('sms_outbox_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sms_outbox',
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            queue_entry_id?: string;
            message_type?: string;
            status?: string;
            body?: string;
            created_at?: string;
            sent_at?: string | null;
          };
          if (!row?.queue_entry_id) return;
          const status = row.status ?? null;
          const messageType = row.message_type ?? null;
          const entryId = row.queue_entry_id;
          const updates: Partial<WaitingRow & ServingRow & HistoryRow> = {};
          if (messageType === 'confirm') updates.confirm_sms_status = status;
          if (messageType === 'next') updates.next_sms_status = status;
          if (messageType === 'serving') updates.serving_sms_status = status;
          if (Object.keys(updates).length) {
            updateEntryInLists(entryId, updates);
          }

          const activeChat = chatEntryRef.current;
          if (activeChat?.queue_entry_id === entryId && row.body) {
            setChatMessages((prev) => {
              const existingIndex = prev.findIndex(
                (message) => message.id === row.id
              );
              const message = {
                id: row.id ?? `outbound:${entryId}:${row.created_at ?? Date.now()}`,
                direction: 'out' as const,
                body: row.body ?? '',
                at: row.sent_at ?? row.created_at ?? new Date().toISOString(),
                status: row.status ?? null,
                messageType,
              };
              if (existingIndex === -1) {
                return [...prev, message].sort(
                  (a, b) => toEpoch(a.at) - toEpoch(b.at)
                );
              }
              const updated = prev.slice();
              const existingMessage = updated[existingIndex];
              if (!existingMessage) {
                return prev;
              }
              updated[existingIndex] = {
                ...existingMessage,
                status: row.status ?? null,
              };
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inboundChannel);
      supabase.removeChannel(outboxChannel);
    };
  }, [
    chatEntryRef,
    debugEnabled,
    historyRef,
    servingRef,
    setChatMessages,
    setHistoryEntries,
    setServingEntries,
    setUnreadEntryIds,
    setWaitingEntries,
    updateEntryInLists,
    waitingRef,
  ]);
}
