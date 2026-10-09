import { useCallback, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ChatEntry, ChatMessage, HistoryRow, ServingRow, WaitingRow, WithEntryId } from '../types';
import {
  initialRealtimeRecoveryState,
  transitionRealtimeRecovery,
  type RealtimeRecoveryState,
} from './realtimeRecovery';
import {
  reconcileInboundRows,
  upsertRealtimeChatMessage,
} from './realtimeReconciliation';
import {
  sortHistoryEntries,
  sortServingEntries,
  sortWaitingEntries,
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
  fetchWaitingEntry: (entryId: string) => Promise<WithEntryId<WaitingRow> | null>;
  fetchServingEntry: (entryId: string) => Promise<WithEntryId<ServingRow> | null>;
  fetchHistoryEntry: (entryId: string) => Promise<WithEntryId<HistoryRow> | null>;
  refreshQueueData: (options?: { showLoading?: boolean; reason?: string }) => Promise<void>;
};

type ChatState = {
  chatEntryRef: React.MutableRefObject<ChatEntry | null>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setUnreadEntryIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  reloadActiveChat: () => Promise<void>;
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
    refreshQueueData,
  } = queueState;
  const { chatEntryRef, setChatMessages, setUnreadEntryIds, reloadActiveChat } = chatState;

  const queueSubCountRef = useRef(0);
  const smsSubCountRef = useRef(0);
  const queueRecoveryRef = useRef<RealtimeRecoveryState>({
    ...initialRealtimeRecoveryState,
  });
  const inboundRecoveryRef = useRef<RealtimeRecoveryState>({
    ...initialRealtimeRecoveryState,
  });
  const outboxRecoveryRef = useRef<RealtimeRecoveryState>({
    ...initialRealtimeRecoveryState,
  });

  const handleSubscriptionStatus = useCallback(
    (
      recoveryRef: React.MutableRefObject<RealtimeRecoveryState>,
      status: string,
      source: string
    ) => {
      const transition = transitionRealtimeRecovery(recoveryRef.current, status);
      recoveryRef.current = transition.state;
      if (!transition.shouldRefresh) return;
      void Promise.all([
        refreshQueueData({
          showLoading: false,
          reason: `realtime-reconnected-${source}`,
        }),
        reloadActiveChat(),
      ]);
    },
    [refreshQueueData, reloadActiveChat]
  );

  // Changes also affect joined customer fields and every other entry's rank.
  // Re-read the authoritative views; delayed per-entry reads can resurrect a
  // settled visit or leave the old location visible after a move.
  const handleQueueEntryChange = useCallback(async () => {
    await refreshQueueData({ showLoading: false, reason: 'realtime-queue-change' });
  }, [refreshQueueData]);

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
        () => {
          void handleQueueEntryChange();
        }
      )
      .subscribe((status) => {
        handleSubscriptionStatus(queueRecoveryRef, status, 'queue');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queueId, debugEnabled, handleQueueEntryChange, handleSubscriptionStatus]);

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
            queue_entry_id?: string | null;
            from_phone?: string;
            body?: string;
            received_at?: string;
            id?: string;
          };
          if (!row?.queue_entry_id || !row.received_at) return;
          const receivedAt = row.received_at;
          const entryId = row.queue_entry_id;
          const body = row.body ?? '';

          const inboundEvent = { entryId, body, receivedAt };
          const waitingUpdate = reconcileInboundRows(
            waitingRef.current,
            inboundEvent
          );
          const servingUpdate = reconcileInboundRows(
            servingRef.current,
            inboundEvent
          );
          const historyUpdate = reconcileInboundRows(
            historyRef.current,
            inboundEvent
          );
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
          if (activeChat?.queue_entry_id === entryId) {
            setChatMessages((prev) =>
              upsertRealtimeChatMessage(prev, {
                id: `inbound:${row.id ?? receivedAt}`,
                direction: 'in',
                body,
                at: receivedAt,
              })
            );
          }
        }
      )
      .subscribe((status) => {
        handleSubscriptionStatus(inboundRecoveryRef, status, 'inbound-sms');
      });

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
              const message = {
                id: row.id ?? `outbound:${entryId}:${row.created_at ?? Date.now()}`,
                direction: 'out' as const,
                body: row.body ?? '',
                at: row.sent_at ?? row.created_at ?? new Date().toISOString(),
                status: row.status ?? null,
                messageType,
              };
              return upsertRealtimeChatMessage(prev, message);
            });
          }
        }
      )
      .subscribe((status) => {
        handleSubscriptionStatus(outboxRecoveryRef, status, 'outbound-sms');
      });

    return () => {
      supabase.removeChannel(inboundChannel);
      supabase.removeChannel(outboxChannel);
    };
  }, [
    chatEntryRef,
    debugEnabled,
    historyRef,
    handleSubscriptionStatus,
    reloadActiveChat,
    refreshQueueData,
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
