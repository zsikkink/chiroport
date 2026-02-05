import type {
  ChatEntry,
  HistoryRow,
  ServingRow,
  SmsStatus,
  SupabaseErrorShape,
  WaitingRow,
  WithEntryId,
} from './types';

export const CUSTOMER_TYPE_PRIORITY: Record<string, number> = {
  paying: 0,
  priority_pass: 1,
};

export function toEpoch(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function sortWaitingEntries(rows: WithEntryId<WaitingRow>[]) {
  return [...rows].sort((a, b) => {
    const priorityA =
      CUSTOMER_TYPE_PRIORITY[a.customer_type ?? 'priority_pass'] ?? 1;
    const priorityB =
      CUSTOMER_TYPE_PRIORITY[b.customer_type ?? 'priority_pass'] ?? 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    const sortA = Number(a.sort_key ?? 0);
    const sortB = Number(b.sort_key ?? 0);
    if (sortA !== sortB) return sortA - sortB;
    return toEpoch(a.created_at) - toEpoch(b.created_at);
  });
}

export function sortServingEntries(rows: WithEntryId<ServingRow>[]) {
  return [...rows].sort((a, b) => toEpoch(a.created_at) - toEpoch(b.created_at));
}

export function sortHistoryEntries(rows: WithEntryId<HistoryRow>[]) {
  return [...rows].sort((a, b) => toEpoch(b.end_ts) - toEpoch(a.end_ts));
}

export function upsertEntry<T extends { queue_entry_id: string }>(
  rows: T[],
  next: T
) {
  const index = rows.findIndex((row) => row.queue_entry_id === next.queue_entry_id);
  if (index === -1) {
    return [...rows, next];
  }
  if (rows[index] === next) {
    return rows;
  }
  const updated = rows.slice();
  updated[index] = next;
  return updated;
}

export function removeEntry<T extends { queue_entry_id: string }>(
  rows: T[],
  entryId: string
) {
  const index = rows.findIndex((row) => row.queue_entry_id === entryId);
  if (index === -1) return rows;
  return [...rows.slice(0, index), ...rows.slice(index + 1)];
}

export function toChatEntry(entry: {
  queue_entry_id: string;
  full_name: string | null;
  phone_e164: string | null;
  service_label?: string | null;
  customer_type?: string | null;
  created_at?: string | null;
}): ChatEntry {
  return {
    queue_entry_id: entry.queue_entry_id,
    full_name: entry.full_name ?? null,
    phone_e164: entry.phone_e164 ?? null,
    service_label: entry.service_label ?? entry.customer_type ?? null,
    created_at: entry.created_at ?? null,
  };
}

export function formatSupabaseError(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const err = error as SupabaseErrorShape;
  const message = err.message?.trim() || fallback;
  const detailParts = [
    err.code ? `code: ${err.code}` : null,
    err.details ? `details: ${err.details}` : null,
    err.hint ? `hint: ${err.hint}` : null,
  ].filter(Boolean);
  return detailParts.length ? `${message} (${detailParts.join(' | ')})` : message;
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatWaitedLabel(
  servedAt: string | null | undefined,
  createdAt: string | null | undefined
) {
  if (!servedAt || !createdAt) return null;
  const servedMs = new Date(servedAt).getTime();
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(servedMs) || Number.isNaN(createdMs)) return null;
  const diffMinutes = Math.max(0, Math.round((servedMs - createdMs) / 60000));
  const label = diffMinutes === 1 ? '1 minute' : `${diffMinutes} minutes`;
  return `Waited ${label}`;
}

export function formatStatusLabel(status: string | null | undefined) {
  if (!status) return 'unknown';
  if (status === 'no_show' || status === 'cancelled') return 'canceled';
  return status;
}

export function formatSmsStatus(status: SmsStatus) {
  if (!status || status === 'n/a') {
    return { label: status === 'n/a' ? 'N/A' : '—', className: 'text-black/40' };
  }
  switch (status) {
    case 'sent':
      return { label: 'Sent', className: 'text-emerald-700' };
    case 'queued':
      return { label: 'Queued', className: 'text-amber-700' };
    case 'sending':
      return { label: 'Sending', className: 'text-amber-700' };
    case 'failed':
      return { label: 'Failed', className: 'text-red-600' };
    case 'dead':
      return { label: 'Dead', className: 'text-red-600' };
    default:
      return { label: status, className: 'text-black/70' };
  }
}

export function formatConfirmSmsStatus(status: SmsStatus) {
  if (status === 'sent') {
    return { label: 'Sent', className: 'text-emerald-700' };
  }
  return { label: "Didn't send", className: 'text-red-600' };
}

export function formatServingSmsStatus(status: SmsStatus) {
  if (status === 'sent') {
    return { label: 'Sent', className: 'text-emerald-700' };
  }
  return { label: "Didn't send", className: 'text-red-600' };
}

export async function resolveActionError(error: unknown, fallback: string) {
  const err = error as { context?: Response; message?: string };
  if (err?.context) {
    try {
      const raw = await err.context.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed?.error) {
            return parsed.error;
          }
        } catch {
          return raw;
        }
      }
    } catch {
      // Ignore response parsing failures.
    }
  }
  return formatSupabaseError(error, fallback);
}

export function hasQueueEntryId<T extends { queue_entry_id: string | null }>(
  row: T
): row is T & { queue_entry_id: string } {
  return Boolean(row.queue_entry_id);
}
