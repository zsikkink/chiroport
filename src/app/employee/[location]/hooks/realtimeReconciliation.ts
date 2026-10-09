import type {
  ChatMessage,
  HistoryRow,
  ServingRow,
  WaitingRow,
  WithEntryId,
} from '../types';
import { removeEntry, toEpoch } from '../utils';

type InboundCapableRow = {
  queue_entry_id: string;
  last_inbound_at?: string | null;
  last_inbound_body?: string | null;
};

export function reconcileInboundRows<T extends InboundCapableRow>(
  rows: T[],
  event: { entryId: string; body: string; receivedAt: string }
) {
  const updatedEntryIds = new Set<string>();
  let nextRows = rows;

  rows.forEach((entry, index) => {
    if (entry.queue_entry_id !== event.entryId) return;
    if (
      entry.last_inbound_at &&
      toEpoch(event.receivedAt) <= toEpoch(entry.last_inbound_at)
    ) {
      return;
    }
    if (nextRows === rows) nextRows = rows.slice();
    nextRows[index] = {
      ...entry,
      last_inbound_body: event.body,
      last_inbound_at: event.receivedAt,
    };
    updatedEntryIds.add(entry.queue_entry_id);
  });

  return { rows: nextRows, updatedEntryIds };
}

export function upsertRealtimeChatMessage(
  messages: ChatMessage[],
  message: ChatMessage
) {
  const existingIndex = messages.findIndex((item) => item.id === message.id);
  const next = messages.slice();
  if (existingIndex === -1) next.push(message);
  else next[existingIndex] = { ...next[existingIndex], ...message };
  return next.sort((left, right) => toEpoch(left.at) - toEpoch(right.at));
}

export function reconcileRealtimeDelete(
  lists: {
    waiting: WithEntryId<WaitingRow>[];
    serving: WithEntryId<ServingRow>[];
    history: WithEntryId<HistoryRow>[];
  },
  entryId: string
) {
  return {
    waiting: removeEntry(lists.waiting, entryId),
    serving: removeEntry(lists.serving, entryId),
    history: removeEntry(lists.history, entryId),
  };
}
