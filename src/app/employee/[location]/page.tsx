'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type DragEvent,
  type MouseEvent,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { ResponsiveCard, Button, LoadingSpinner, Heading } from '@/components/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireEnv } from '@/lib/supabase/helpers';
import type { Database } from '@/lib/supabase/database.types';
import { toLocationSlug } from '@/lib/locationSlug';

type EmployeeProfile = {
  role: Database['public']['Enums']['employee_role'];
  is_open: boolean;
};

type LocationOption = {
  id: string;
  display_name: string;
  airport_code: string;
  code: string;
};

type WaitingRow =
  Database['public']['Views']['employee_queue_waiting_view']['Row'];
type ServingRow =
  Database['public']['Views']['employee_queue_serving_view']['Row'];
type HistoryRow =
  Database['public']['Views']['employee_queue_history_view']['Row'];
type WithEntryId<T> = T & { queue_entry_id: string };
type MenuEntry = WithEntryId<WaitingRow | ServingRow | HistoryRow>;

const supabase = getSupabaseBrowserClient();

type SupabaseErrorShape = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type SmsStatus = string | null | undefined;

type ChatEntry = {
  queue_entry_id: string;
  full_name: string | null;
  phone_e164: string | null;
  service_label: string | null;
  created_at: string | null;
};

type ChatMessage = {
  id: string;
  direction: 'in' | 'out';
  body: string;
  at: string;
  status?: string | null;
  messageType?: string | null;
};

type DragPayload = {
  entryId: string;
  status: string | null;
};

type TreatmentOption = {
  label: string;
  customerType: 'paying' | 'priority_pass';
};

type EditFormState = {
  fullName: string;
  email: string;
  phone: string;
  serviceLabel: string;
  customerType: 'paying' | 'priority_pass';
};

type CreateFormState = {
  fullName: string;
  email: string;
  phone: string;
  serviceLabel: string;
  customerType: 'paying' | 'priority_pass';
  consent: boolean;
};

type EntrySnapshot = {
  entryId: string;
  waiting?: WithEntryId<WaitingRow>;
  serving?: WithEntryId<ServingRow>;
  history?: WithEntryId<HistoryRow>;
};

const CUSTOMER_TYPE_PRIORITY: Record<string, number> = {
  paying: 0,
  priority_pass: 1,
};

const TREATMENT_OPTIONS: TreatmentOption[] = [
  { label: 'Chiropractor', customerType: 'paying' },
  { label: 'Priority Pass', customerType: 'priority_pass' },
  { label: 'Priority Pass + Adjustments', customerType: 'paying' },
  { label: 'Massage: 15 minutes', customerType: 'paying' },
  { label: 'Massage: 20 minutes', customerType: 'paying' },
  { label: 'Massage: 30 minutes', customerType: 'paying' },
];

function toEpoch(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortWaitingEntries(rows: WithEntryId<WaitingRow>[]) {
  return [...rows].sort((a, b) => {
    const priorityA = CUSTOMER_TYPE_PRIORITY[a.customer_type ?? 'priority_pass'] ?? 1;
    const priorityB = CUSTOMER_TYPE_PRIORITY[b.customer_type ?? 'priority_pass'] ?? 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    const sortA = Number(a.sort_key ?? 0);
    const sortB = Number(b.sort_key ?? 0);
    if (sortA !== sortB) return sortA - sortB;
    return toEpoch(a.created_at) - toEpoch(b.created_at);
  });
}

function sortServingEntries(rows: WithEntryId<ServingRow>[]) {
  return [...rows].sort((a, b) => toEpoch(a.created_at) - toEpoch(b.created_at));
}

function sortHistoryEntries(rows: WithEntryId<HistoryRow>[]) {
  return [...rows].sort((a, b) => toEpoch(b.end_ts) - toEpoch(a.end_ts));
}

function upsertEntry<T extends { queue_entry_id: string }>(rows: T[], next: T) {
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

function removeEntry<T extends { queue_entry_id: string }>(
  rows: T[],
  entryId: string
) {
  const index = rows.findIndex((row) => row.queue_entry_id === entryId);
  if (index === -1) return rows;
  return [...rows.slice(0, index), ...rows.slice(index + 1)];
}

type WaitingEntryCardProps = {
  entry: WithEntryId<WaitingRow>;
  isServingBusy: boolean;
  isCancelBusy: boolean;
  isDeleteBusy: boolean;
  hasUnread: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onAdvance: (entryId: string) => void;
  onOpenChat: (entry: ChatEntry) => void;
  menuOpen: boolean;
  canMove: boolean;
  onCloseMenu: () => void;
  onMove: (entry: MenuEntry) => void;
  onEdit: (entry: MenuEntry) => void;
  onDelete: (entryId: string) => void;
};

const WaitingEntryCard = memo(function WaitingEntryCard({
  entry,
  isServingBusy,
  isCancelBusy,
  isDeleteBusy,
  hasUnread,
  onDragStart,
  onContextMenu,
  onAdvance,
  onOpenChat,
  menuOpen,
  canMove,
  onCloseMenu,
  onMove,
  onEdit,
  onDelete,
}: WaitingEntryCardProps) {
  const confirmStatus = formatConfirmSmsStatus(entry.confirm_sms_status);
  const nextStatus = formatSmsStatus(
    entry.customer_type === 'paying' ? entry.next_sms_status : 'n/a'
  );
  const serviceLabel = entry.service_label ?? entry.customer_type ?? 'unknown';

  return (
    <div
      className="rounded-md border border-black/10 bg-white text-black p-3"
      draggable
      onDragStart={onDragStart}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-[1.05rem] font-semibold">
          {entry.full_name ?? 'Unknown'}
        </p>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            className="relative rounded-full bg-black/10 p-1 text-black hover:bg-black/20"
            onClick={() => onOpenChat(toChatEntry(entry))}
            aria-label="Message customer"
            title="Message customer"
          >
            {hasUnread ? (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
            ) : null}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.4-.2-3.4-.6L3 21l1.6-6.1a8.5 8.5 0 1 1 16.4-3.4Z" />
            </svg>
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-500 p-1 text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onAdvance(entry.queue_entry_id)}
            disabled={isServingBusy || isCancelBusy || isDeleteBusy}
            aria-label="Move to serving"
            title="Serve"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </button>
          <EntryActionMenu
            entry={entry}
            isDeleteBusy={isDeleteBusy}
            menuOpen={menuOpen}
            canMove={canMove}
            onCloseMenu={onCloseMenu}
            onMove={onMove}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
      <p className="text-sm text-black/70">
        {serviceLabel} · Joined at {formatTime(entry.created_at)}
      </p>
      <p className="mt-2 text-sm">
        <span className={confirmStatus.className}>
          Confirmation SMS: {confirmStatus.label}
        </span>
        {' · '}
        <span className={nextStatus.className}>
          Next SMS: {nextStatus.label}
        </span>
      </p>
      <p className="text-sm text-black/70">
        {entry.phone_e164 ?? '—'} · {entry.email ?? '—'}
      </p>
    </div>
  );
});

type ServingEntryCardProps = {
  entry: WithEntryId<ServingRow>;
  isCompleteBusy: boolean;
  isCancelBusy: boolean;
  isDeleteBusy: boolean;
  isReturnBusy: boolean;
  hasUnread: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onAdvance: (entryId: string) => void;
  onOpenChat: (entry: ChatEntry) => void;
  menuOpen: boolean;
  canMove: boolean;
  onCloseMenu: () => void;
  onMove: (entry: MenuEntry) => void;
  onEdit: (entry: MenuEntry) => void;
  onDelete: (entryId: string) => void;
};

const ServingEntryCard = memo(function ServingEntryCard({
  entry,
  isCompleteBusy,
  isCancelBusy,
  isDeleteBusy,
  isReturnBusy,
  hasUnread,
  onDragStart,
  onContextMenu,
  onAdvance,
  onOpenChat,
  menuOpen,
  canMove,
  onCloseMenu,
  onMove,
  onEdit,
  onDelete,
}: ServingEntryCardProps) {
  const confirmStatus = formatConfirmSmsStatus(entry.confirm_sms_status);
  const servingStatus = formatServingSmsStatus(entry.serving_sms_status);
  const serviceLabel = entry.service_label ?? entry.customer_type ?? 'unknown';
  const waitedLabel = formatWaitedLabel(entry.served_at, entry.created_at);

  return (
    <div
      className="rounded-md border border-black/10 bg-white text-black p-3"
      draggable
      onDragStart={onDragStart}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-[1.05rem] font-semibold">
          {entry.full_name ?? 'Unknown'}
        </p>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            className="relative rounded-full bg-black/10 p-1 text-black hover:bg-black/20"
            onClick={() => onOpenChat(toChatEntry(entry))}
            aria-label="Message customer"
            title="Message customer"
          >
            {hasUnread ? (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
            ) : null}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.4-.2-3.4-.6L3 21l1.6-6.1a8.5 8.5 0 1 1 16.4-3.4Z" />
            </svg>
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-500 p-1 text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onAdvance(entry.queue_entry_id)}
            disabled={isCompleteBusy || isCancelBusy || isDeleteBusy || isReturnBusy}
            aria-label="Mark completed"
            title="Complete"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </button>
          <EntryActionMenu
            entry={entry}
            isDeleteBusy={isDeleteBusy}
            menuOpen={menuOpen}
            canMove={canMove}
            onCloseMenu={onCloseMenu}
            onMove={onMove}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
      <p className="text-sm text-black/70">
        {serviceLabel} · {waitedLabel ?? `Joined at ${formatTime(entry.created_at)}`}
      </p>
      <p className="mt-2 text-sm">
        <span className={confirmStatus.className}>
          Confirmation SMS: {confirmStatus.label}
        </span>
        {' · '}
        <span className={servingStatus.className}>
          Serving SMS: {servingStatus.label}
        </span>
      </p>
      <p className="text-sm text-black/70">
        {entry.phone_e164 ?? '—'} · {entry.email ?? '—'}
      </p>
    </div>
  );
});

type HistoryEntryCardProps = {
  entry: WithEntryId<HistoryRow>;
  isDeleteBusy: boolean;
  hasUnread: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onDelete: (entryId: string) => void;
  onOpenChat: (entry: ChatEntry) => void;
  onToggleMenu: (entryId: string) => void;
  onCloseMenu: () => void;
  menuOpen: boolean;
  canMove: boolean;
  onMove: (entry: MenuEntry) => void;
  onEdit: (entry: MenuEntry) => void;
};

type EntryActionMenuProps = {
  entry: MenuEntry;
  isDeleteBusy: boolean;
  menuOpen: boolean;
  canMove: boolean;
  onCloseMenu: () => void;
  onMove: (entry: MenuEntry) => void;
  onEdit: (entry: MenuEntry) => void;
  onDelete: (entryId: string) => void;
};

const EntryActionMenu = memo(function EntryActionMenu({
  entry,
  isDeleteBusy,
  menuOpen,
  canMove,
  onCloseMenu,
  onMove,
  onEdit,
  onDelete,
}: EntryActionMenuProps) {
  if (!menuOpen) return null;
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-20 cursor-default"
        onClick={onCloseMenu}
        aria-label="Close menu"
      />
      <div className="absolute right-0 top-7 z-30 w-36 rounded-lg bg-white text-black opacity-100 shadow-xl ring-1 ring-black/20">
        {canMove ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5"
            onClick={() => onMove(entry)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M12 4v16" />
              <path d="M4 12h16" />
              <path d="M12 4l-3 3" />
              <path d="M12 4l3 3" />
              <path d="M12 20l-3-3" />
              <path d="M12 20l3-3" />
              <path d="M4 12l3-3" />
              <path d="M4 12l3 3" />
              <path d="M20 12l-3-3" />
              <path d="M20 12l-3 3" />
            </svg>
            <span>Move</span>
          </button>
        ) : null}
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5"
          onClick={() => onEdit(entry)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <span>Edit</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          disabled={isDeleteBusy}
          onClick={() => onDelete(entry.queue_entry_id)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M6 6l1 14h10l1-14" />
          </svg>
          <span>Delete</span>
        </button>
      </div>
    </>
  );
});

const HistoryEntryCard = memo(function HistoryEntryCard({
  entry,
  isDeleteBusy,
  hasUnread,
  onDragStart,
  onContextMenu,
  onDelete,
  onOpenChat,
  onToggleMenu,
  onCloseMenu,
  menuOpen,
  canMove,
  onMove,
  onEdit,
}: HistoryEntryCardProps) {
  const confirmStatus = formatConfirmSmsStatus(entry.confirm_sms_status);
  const servingStatus = formatServingSmsStatus(entry.serving_sms_status);
  const statusLabel = formatStatusLabel(entry.status);
  const statusTimestamp = formatTime(entry.end_ts);
  const statusLine = statusLabel ? `${statusLabel} at ${statusTimestamp}` : statusTimestamp;

  return (
    <div
      className="rounded-md border border-black/10 bg-white text-black p-3"
      draggable
      onDragStart={onDragStart}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-[1.05rem] font-semibold">
          {entry.full_name ?? 'Unknown'}
        </p>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            className="relative rounded-full bg-black/10 p-1 text-black hover:bg-black/20"
            onClick={() => onOpenChat(toChatEntry(entry))}
            aria-label="Message customer"
            title="Message customer"
          >
            {hasUnread ? (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
            ) : null}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.4-.2-3.4-.6L3 21l1.6-6.1a8.5 8.5 0 1 1 16.4-3.4Z" />
            </svg>
          </button>
          <button
            type="button"
            className="rounded-full bg-black/10 p-1 text-black hover:bg-black/20"
            onClick={() => onToggleMenu(entry.queue_entry_id)}
            aria-label="More actions"
            title="More actions"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
          <EntryActionMenu
            entry={entry}
            isDeleteBusy={isDeleteBusy}
            menuOpen={menuOpen}
            canMove={canMove}
            onCloseMenu={onCloseMenu}
            onMove={onMove}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
      <p className="text-sm text-black/70">
        {entry.service_label ?? entry.customer_type ?? 'unknown'}, {statusLine}
      </p>
      <p className="text-sm text-black/70">
        {entry.phone_e164 ?? '—'} · {entry.email ?? '—'}
      </p>
      <p className="mt-2 text-sm">
        <span className={confirmStatus.className}>
          Confirmation SMS: {confirmStatus.label}
        </span>
        {' · '}
        <span className={servingStatus.className}>
          Serving SMS: {servingStatus.label}
        </span>
      </p>
    </div>
  );
});

function toChatEntry(entry: {
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

function formatSupabaseError(error: unknown, fallback: string) {
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

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatWaitedLabel(
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

function formatStatusLabel(status: string | null | undefined) {
  if (!status) return 'unknown';
  if (status === 'no_show' || status === 'cancelled') return 'canceled';
  return status;
}

function formatSmsStatus(status: SmsStatus) {
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

function formatConfirmSmsStatus(status: SmsStatus) {
  if (status === 'sent') {
    return { label: 'Sent', className: 'text-emerald-700' };
  }
  return { label: "Didn't send", className: 'text-red-600' };
}

function formatServingSmsStatus(status: SmsStatus) {
  if (status === 'sent') {
    return { label: 'Sent', className: 'text-emerald-700' };
  }
  return { label: "Didn't send", className: 'text-red-600' };
}

async function resolveActionError(error: unknown, fallback: string) {
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

function hasQueueEntryId<T extends { queue_entry_id: string | null }>(
  row: T
): row is T & { queue_entry_id: string } {
  return Boolean(row.queue_entry_id);
}

export default function EmployeeDashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [queueId, setQueueId] = useState<string | null>(null);

  const [waitingEntries, setWaitingEntries] = useState<WithEntryId<WaitingRow>[]>([]);
  const [servingEntries, setServingEntries] = useState<WithEntryId<ServingRow>[]>([]);
  const [historyEntries, setHistoryEntries] = useState<WithEntryId<HistoryRow>[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [chatEntry, setChatEntry] = useState<ChatEntry | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [unreadEntryIds, setUnreadEntryIds] = useState<Record<string, boolean>>(
    {}
  );
  const [menuEntryId, setMenuEntryId] = useState<string | null>(null);
  const [moveEntry, setMoveEntry] = useState<MenuEntry | null>(null);
  const [moveTargetLocationId, setMoveTargetLocationId] = useState('');
  const [editEntry, setEditEntry] = useState<MenuEntry | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [createEntryOpen, setCreateEntryOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState | null>(null);
  const [historyDecisionEntryId, setHistoryDecisionEntryId] = useState<string | null>(null);
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const locationParam =
    typeof params?.location === 'string' ? params.location : '';

  const currentUser = session?.user ?? null;
  const debugEnabled = process.env.NODE_ENV !== 'production';
  const renderCountRef = useRef(0);
  const refreshCountRef = useRef(0);
  const queueSubCountRef = useRef(0);
  const smsSubCountRef = useRef(0);
  const waitingRef = useRef(waitingEntries);
  const servingRef = useRef(servingEntries);
  const historyRef = useRef(historyEntries);
  const chatEntryRef = useRef(chatEntry);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const locationOptions = useMemo(() => {
    return locations.map((location) => ({
      ...location,
      slug: toLocationSlug(location.airport_code, location.code),
    }));
  }, [locations]);
  const isAdmin = profile?.role === 'admin';
  const selectedLocation = useMemo(() => {
    return (
      locationOptions.find((location) => location.id === selectedLocationId) ??
      null
    );
  }, [locationOptions, selectedLocationId]);
  const moveLocationOptions = useMemo(() => {
    if (!moveEntry?.location_id) return [];
    const currentLocation = locationOptions.find(
      (location) => location.id === moveEntry.location_id
    );
    if (!currentLocation) return [];
    return locationOptions.filter(
      (location) =>
        location.airport_code === currentLocation.airport_code &&
        location.id !== currentLocation.id
    );
  }, [locationOptions, moveEntry?.location_id]);
  const locationMap = useMemo(() => {
    const map = new Map<string, LocationOption>();
    locationOptions.forEach((location) => {
      map.set(location.id, location);
    });
    return map;
  }, [locationOptions]);
  const airportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    locationOptions.forEach((location) => {
      counts[location.airport_code] = (counts[location.airport_code] ?? 0) + 1;
    });
    return counts;
  }, [locationOptions]);
  const canMoveEntry = useCallback(
    (entry: { location_id: string | null }) => {
      if (!entry.location_id) return false;
      const airportCode = locationMap.get(entry.location_id)?.airport_code;
      if (!airportCode) return false;
      return (airportCounts[airportCode] ?? 0) > 1;
    },
    [airportCounts, locationMap]
  );

  renderCountRef.current += 1;
  if (debugEnabled) {
    // eslint-disable-next-line no-console
    console.debug(`[employee] render #${renderCountRef.current}`);
  }

  useEffect(() => {
    waitingRef.current = waitingEntries;
  }, [waitingEntries]);

  useEffect(() => {
    servingRef.current = servingEntries;
  }, [servingEntries]);

  useEffect(() => {
    historyRef.current = historyEntries;
  }, [historyEntries]);

  useEffect(() => {
    chatEntryRef.current = chatEntry;
  }, [chatEntry]);

  useEffect(() => {
    if (!moveEntry) {
      setMoveTargetLocationId('');
      return;
    }
    setMoveTargetLocationId(moveLocationOptions[0]?.id ?? '');
  }, [moveEntry, moveLocationOptions]);

  useEffect(() => {
    if (!editEntry) {
      setEditForm(null);
      return;
    }
    const matchedOption =
      TREATMENT_OPTIONS.find((option) => option.label === editEntry.service_label) ??
      TREATMENT_OPTIONS.find(
        (option) => option.customerType === (editEntry.customer_type ?? 'priority_pass')
      ) ??
      TREATMENT_OPTIONS[0];
    setEditForm({
      fullName: editEntry.full_name ?? '',
      email: editEntry.email ?? '',
      phone: editEntry.phone_e164 ?? '',
      serviceLabel: matchedOption?.label ?? editEntry.service_label ?? 'Paying',
      customerType: matchedOption?.customerType ?? (editEntry.customer_type ?? 'priority_pass'),
    });
  }, [editEntry]);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('role,is_open')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      const message = formatSupabaseError(error, 'Failed to load profile.');
      console.error('[employee] loadProfile failed', { error, userId });
      setAuthError(message);
      setProfile(null);
      return;
    }

    if (!data || !data.is_open) {
      setAccessDenied(true);
      setProfile(null);
      return;
    }

    setAccessDenied(false);
    setProfile({ role: data.role, is_open: data.is_open });
  }, []);

  const loadLocations = useCallback(async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id,display_name,airport_code,code')
      .eq('is_open', true)
      .order('airport_code', { ascending: true })
      .order('code', { ascending: true });

    if (error) {
      const message = formatSupabaseError(error, 'Failed to load locations.');
      console.error('[employee] loadLocations failed', { error });
      setActionError(message);
      return;
    }

    setLocations(data ?? []);
  }, []);

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
      setActionError(message);
      setQueueId(null);
      return;
    }

    setQueueId(data?.id ?? null);
  }, []);

  const refreshQueueData = useCallback(
    async (options?: { showLoading?: boolean; reason?: string }) => {
      if (!selectedLocationId) return;
      const showLoading = options?.showLoading ?? false;
      refreshCountRef.current += 1;
      if (debugEnabled) {
        // eslint-disable-next-line no-console
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
      setActionError('');

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
        setActionError(message);
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
    [selectedLocationId, debugEnabled]
  );

  const loadChatMessages = useCallback(
    async (entry: ChatEntry) => {
      setChatLoading(true);
      setChatError('');
      const hasPhone = Boolean(entry.phone_e164);

      const [outbox, inbound] = await Promise.all([
        supabase
          .from('sms_outbox')
          .select('id, body, status, created_at, sent_at, message_type')
          .eq('queue_entry_id', entry.queue_entry_id)
          .order('created_at', { ascending: true }),
        hasPhone
          ? supabase
              .from('sms_inbound')
              .select('id, body, received_at')
              .eq('from_phone', entry.phone_e164 as string)
              .order('received_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (outbox.error || inbound.error) {
        const rootError = outbox.error || inbound.error;
        const message = formatSupabaseError(
          rootError,
          'Failed to load messages.'
        );
        console.error('[employee] loadChatMessages failed', {
          outboxError: outbox.error,
          inboundError: inbound.error,
        });
        setChatError(message);
        setChatMessages([]);
      } else {
        const outboundMessages: ChatMessage[] = (outbox.data ?? [])
          .filter((row) => row.body && (row.sent_at || row.created_at))
          .map((row) => ({
            id: row.id,
            direction: 'out',
            body: row.body,
            at: row.sent_at ?? row.created_at,
            status: row.status,
            messageType: row.message_type,
          }));

        const inboundMessages: ChatMessage[] = (inbound.data ?? [])
          .filter((row) => row.body && row.received_at)
          .map((row) => ({
            id: row.id,
            direction: 'in',
            body: row.body,
            at: row.received_at,
          }));

        const combined = [...outboundMessages, ...inboundMessages].sort(
          (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
        );

        setChatMessages(combined);
      }

      setChatLoading(false);
    },
    []
  );

  const scrollChatToBottom = useCallback(() => {
    if (!chatListRef.current) return;
    requestAnimationFrame(() => {
      if (!chatListRef.current) return;
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (!chatEntry) return;
    if (chatLoading) return;
    scrollChatToBottom();
  }, [chatEntry, chatLoading, chatMessages.length, scrollChatToBottom]);

  const openChat = useCallback(
    async (entry: ChatEntry) => {
      setChatEntry(null);
      setChatDraft('');
      setChatError('');
      setChatMessages([]);
      setUnreadEntryIds((prev) => {
        if (!prev[entry.queue_entry_id]) return prev;
        const next = { ...prev };
        delete next[entry.queue_entry_id];
        return next;
      });
      await loadChatMessages(entry);
      setChatEntry(entry);
    },
    [loadChatMessages]
  );

  const closeChat = () => {
    setChatEntry(null);
    setChatMessages([]);
    setChatError('');
    setChatDraft('');
  };

  const handleSendMessage = async () => {
    if (!chatEntry) return;
    if (!chatDraft.trim()) return;

    setChatSending(true);
    setChatError('');
    try {
      await invokeEmployeeFunction('send_employee_message', {
        queueEntryId: chatEntry.queue_entry_id,
        body: chatDraft.trim(),
      });

      setChatDraft('');
      await loadChatMessages(chatEntry);
    } catch (error) {
      const message = await resolveActionError(
        error,
        'Failed to send message.'
      );
      setChatError(message);
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      supabase.functions.setAuth(session.access_token);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    loadProfile(currentUser.id);
  }, [currentUser, loadProfile]);

  useEffect(() => {
    if (profile) {
      loadLocations();
    }
  }, [profile, loadLocations]);

  useEffect(() => {
    if (!locationOptions.length) return;
    const resolvedLocation =
      locationOptions.find((location) => location.slug === locationParam) ??
      locationOptions[0];
    if (!resolvedLocation) return;
    if (resolvedLocation.id !== selectedLocationId) {
      setSelectedLocationId(resolvedLocation.id);
    }
    if (locationParam !== resolvedLocation.slug) {
      router.replace(`/employee/${resolvedLocation.slug}`);
    }
  }, [
    locationOptions,
    locationParam,
    router,
    selectedLocationId,
  ]);

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
    setUnreadEntryIds((prev) => {
      if (!prev[entryId]) return prev;
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
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
      const base =
        snapshot.waiting ?? snapshot.serving ?? snapshot.history ?? null;
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
      const base =
        snapshot.waiting ?? snapshot.serving ?? snapshot.history ?? null;
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
      const base =
        snapshot.waiting ?? snapshot.serving ?? snapshot.history ?? null;
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
        // eslint-disable-next-line no-console
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
      removeEntryFromLists,
      updateEntryInLists,
    ]
  );

  useEffect(() => {
    if (!queueId) return;
    queueSubCountRef.current += 1;
    if (debugEnabled) {
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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
  }, [debugEnabled, updateEntryInLists]);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

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
        userId: currentUser?.id,
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
    [currentUser?.id, queueId, selectedLocationId]
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
        restoreEntrySnapshot(snapshot);
      }
      return success;
    },
    [restoreEntrySnapshot, runAction]
  );

  const getFunctionHeaders = useCallback(async () => {
    const anonKey = requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error('You are not signed in.');
    }
    let activeSession = data.session;
    const expiresAt = activeSession.expires_at
      ? activeSession.expires_at * 1000
      : 0;
    if (expiresAt && expiresAt - Date.now() < 30_000) {
      const { data: refreshed, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session?.access_token) {
        throw new Error('Session expired. Please sign in again.');
      }
      activeSession = refreshed.session;
    }
    supabase.functions.setAuth(activeSession.access_token);
    return {
      Authorization: `Bearer ${activeSession.access_token}`,
      apikey: anonKey,
    };
  }, []);

  const callQueueEntryAction = useCallback(
    async (
      action: string,
      entryId: string,
      extra?: Record<string, unknown>
    ) => {
      const headers = await getFunctionHeaders();
      const { data, error } = await supabase.functions.invoke(
        'queue_entry_action',
        {
          body: { action, queueEntryId: entryId, ...extra },
          headers,
        }
      );
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }
    },
    [getFunctionHeaders]
  );

  const invokeEmployeeFunction = useCallback(
    async (name: string, body: Record<string, unknown>) => {
      const supabaseUrl = requireEnv(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        'NEXT_PUBLIC_SUPABASE_URL'
      );

      const requestOnce = async () => {
        const headers = await getFunctionHeaders();
        const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        const raw = await response.text();
        let parsed: Record<string, unknown> = {};
        if (raw) {
          try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            parsed = { raw };
          }
        }
        return { response, raw, parsed };
      };

      let result = await requestOnce();
      if (
        (result.response.status === 401 || result.response.status === 403) &&
        (result.parsed as { error?: string })?.error === 'Unauthorized'
      ) {
        const { data: refreshed, error: refreshError } =
          await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session?.access_token) {
          throw new Error('Session expired. Please sign in again.');
        }
        result = await requestOnce();
      }

      if (!result.response.ok) {
        const errorValue = (result.parsed as { error?: string })?.error;
        if (errorValue) {
          throw new Error(errorValue);
        }
        throw new Error(result.raw || `Edge Function error (${result.response.status})`);
      }

      if (result.parsed && typeof result.parsed === 'object' && 'error' in result.parsed) {
        const errorValue = (result.parsed as { error?: string }).error;
        if (errorValue) {
          throw new Error(errorValue);
        }
      }
      return result.parsed;
    },
    [getFunctionHeaders]
  );


  const handleSetServing = useCallback(
    async (entryId: string) => {
      await runOptimisticAction(
        `serving:${entryId}`,
        () => applyOptimisticServing(entryId),
        async () => {
          await callQueueEntryAction('serving', entryId);
        },
        { entryId }
      );
    },
    [applyOptimisticServing, callQueueEntryAction, runOptimisticAction]
  );

  const handleComplete = useCallback(
    async (entryId: string) => {
      await runOptimisticAction(
        `complete:${entryId}`,
        () => applyOptimisticHistory(entryId, 'completed'),
        async () => {
          await callQueueEntryAction('complete', entryId);
        },
        { entryId }
      );
    },
    [applyOptimisticHistory, callQueueEntryAction, runOptimisticAction]
  );

  const handleCancel = useCallback(
    async (entryId: string) => {
      await runOptimisticAction(
        `cancel:${entryId}`,
        () => applyOptimisticHistory(entryId, 'cancelled'),
        async () => {
          await callQueueEntryAction('cancel', entryId);
        },
        { entryId }
      );
    },
    [applyOptimisticHistory, callQueueEntryAction, runOptimisticAction]
  );

  const handleReturnToQueue = useCallback(
    async (entryId: string) => {
      await runOptimisticAction(
        `return:${entryId}`,
        () => applyOptimisticWaiting(entryId),
        async () => {
          await callQueueEntryAction('return', entryId);
        },
        { entryId }
      );
    },
    [applyOptimisticWaiting, callQueueEntryAction, runOptimisticAction]
  );

  const handleDragStart = useCallback(
    (entryId: string, status: string | null) =>
      (event: DragEvent<HTMLDivElement>) => {
        const payload: DragPayload = { entryId, status };
        event.dataTransfer.setData('text/plain', JSON.stringify(payload));
        event.dataTransfer.effectAllowed = 'move';
      },
    []
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (target: 'waiting' | 'serving' | 'history') =>
      async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData('text/plain');
        if (!raw) return;
        let payload: DragPayload | null = null;
        try {
          payload = JSON.parse(raw) as DragPayload;
        } catch {
          return;
        }
        if (!payload?.entryId) return;
        const fromStatus = payload.status ?? null;

        if (target === 'waiting') {
          if (fromStatus === 'waiting') return;
          await handleReturnToQueue(payload.entryId);
          return;
        }

        if (target === 'serving') {
          if (fromStatus === 'serving') return;
          if (fromStatus === 'waiting') {
            await handleSetServing(payload.entryId);
            return;
          }
          await runOptimisticAction(
            `serving_move:${payload.entryId}`,
            () => applyOptimisticServing(payload.entryId),
            async () => {
              await callQueueEntryAction('serving', payload.entryId);
            },
            { entryId: payload.entryId }
          );
          return;
        }

        if (target === 'history') {
          if (['completed', 'cancelled', 'no_show'].includes(fromStatus ?? '')) {
            return;
          }
          setHistoryDecisionEntryId(payload.entryId);
        }
      },
    [
      applyOptimisticServing,
      callQueueEntryAction,
      handleReturnToQueue,
      handleSetServing,
      runOptimisticAction,
    ]
  );

  const handleDelete = useCallback(
    async (entryId: string) => {
      const confirmed = window.confirm(
        'Delete this queue entry? This cannot be undone.'
      );
      if (!confirmed) return;

      await runOptimisticAction(
        `delete:${entryId}`,
        () => applyOptimisticRemoval(entryId),
        async () => {
          await callQueueEntryAction('delete', entryId);
          removeEntryFromLists(entryId);
          if (chatEntryRef.current?.queue_entry_id === entryId) {
            setChatEntry(null);
            setChatMessages([]);
            setChatError('');
            setChatDraft('');
          }
        },
        { entryId }
      );
    },
    [
      applyOptimisticRemoval,
      callQueueEntryAction,
      removeEntryFromLists,
      runOptimisticAction,
    ]
  );

  const handleDeleteFromMenu = useCallback(
    (entryId: string) => {
      setMenuEntryId(null);
      void handleDelete(entryId);
    },
    [handleDelete]
  );

  const handleToggleMenu = useCallback((entryId: string) => {
    setMenuEntryId((prev) => (prev === entryId ? null : entryId));
  }, []);

  const closeMenu = useCallback(() => {
    setMenuEntryId(null);
  }, []);

  const handleOpenMove = useCallback((entry: MenuEntry) => {
    setMenuEntryId(null);
    setMoveEntry(entry);
  }, []);

  const handleOpenEdit = useCallback((entry: MenuEntry) => {
    setMenuEntryId(null);
    setEditEntry(entry);
  }, []);

  const handleCloseMove = useCallback(() => {
    setMoveEntry(null);
    setMoveTargetLocationId('');
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditEntry(null);
    setEditForm(null);
  }, []);

  const handleOpenCreateEntry = useCallback(() => {
    const option = TREATMENT_OPTIONS[0] ?? {
      label: 'Paying',
      customerType: 'paying' as const,
    };
    setCreateForm({
      fullName: '',
      email: '',
      phone: '',
      serviceLabel: option.label,
      customerType: option.customerType,
      consent: false,
    });
    setCreateEntryOpen(true);
  }, []);

  const handleCloseCreateEntry = useCallback(() => {
    setCreateEntryOpen(false);
    setCreateForm(null);
  }, []);

  const handleEntryContextMenu = useCallback(
    (entryId: string) => (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      setMenuEntryId(entryId);
    },
    []
  );

  const handleCloseHistoryDecision = useCallback(() => {
    setHistoryDecisionEntryId(null);
  }, []);

  const handleConfirmHistoryDecision = useCallback(
    async (action: 'completed' | 'canceled') => {
      if (!historyDecisionEntryId) return;
      if (action === 'completed') {
        await handleComplete(historyDecisionEntryId);
      } else {
        await handleCancel(historyDecisionEntryId);
      }
      setHistoryDecisionEntryId(null);
    },
    [handleCancel, handleComplete, historyDecisionEntryId]
  );

  const handleMoveSubmit = useCallback(async () => {
    if (!moveEntry) return;
    if (!moveTargetLocationId) {
      setActionError('Select a target location.');
      return;
    }

    const success = await runOptimisticAction(
      `move:${moveEntry.queue_entry_id}`,
      () => applyOptimisticRemoval(moveEntry.queue_entry_id),
      async () => {
        await callQueueEntryAction('move', moveEntry.queue_entry_id, {
          targetLocationId: moveTargetLocationId,
        });
      },
      { entryId: moveEntry.queue_entry_id, targetLocationId: moveTargetLocationId }
    );

    if (success) {
      removeEntryFromLists(moveEntry.queue_entry_id);
      setMoveEntry(null);
      setMoveTargetLocationId('');
    }
  }, [
    callQueueEntryAction,
    moveEntry,
    moveTargetLocationId,
    runOptimisticAction,
    removeEntryFromLists,
    applyOptimisticRemoval,
  ]);

  const handleCreateSubmit = useCallback(async () => {
    if (!createForm) return;
    if (!selectedLocation) {
      setActionError('Select a location.');
      return;
    }
    if (
      !createForm.fullName.trim() ||
      !createForm.email.trim() ||
      !createForm.phone.trim()
    ) {
      setActionError('Name, email, and phone are required.');
      return;
    }
    if (!createForm.consent) {
      setActionError('Consent is required.');
      return;
    }

    const consentKey =
      createForm.serviceLabel === 'Chiropractor'
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
            name: createForm.fullName.trim(),
            phone: createForm.phone.trim(),
            email: createForm.email.trim(),
            consent: true,
            customerType: createForm.customerType,
            serviceLabel: createForm.serviceLabel,
            consentKey,
          },
          headers,
        });

        if (error) throw error;
        const parsed =
          typeof data === 'string' ? (JSON.parse(data) as Record<string, unknown>) : data;
        if (!parsed || (parsed as { error?: string }).error) {
          throw new Error((parsed as { error?: string })?.error || 'Failed to create entry');
        }
        const entryId = (parsed as { queueEntryId?: string }).queueEntryId;
        if (!entryId) {
          throw new Error('Queue entry was not created.');
        }

        const row = await fetchWaitingEntry(entryId);
        if (row) {
          setWaitingEntries((prev) => sortWaitingEntries(upsertEntry(prev, row)));
        } else {
          await refreshQueueData({ showLoading: false, reason: 'create-entry' });
        }
      },
      { locationId: selectedLocation.id }
    );

    if (success) {
      handleCloseCreateEntry();
    }
  }, [
    createForm,
    fetchWaitingEntry,
    getFunctionHeaders,
    handleCloseCreateEntry,
    refreshQueueData,
    runAction,
    selectedLocation,
  ]);

  const handleEditSubmit = useCallback(async () => {
    if (!editEntry || !editForm) return;
    const optimisticUpdates = {
      full_name: editForm.fullName.trim() || null,
      email: editForm.email.trim().toLowerCase() || null,
      phone_e164: editForm.phone.trim() || null,
      service_label: editForm.serviceLabel,
      customer_type: editForm.customerType,
    };
    const success = await runOptimisticAction(
      `edit:${editEntry.queue_entry_id}`,
      () => applyOptimisticEdit(editEntry.queue_entry_id, optimisticUpdates),
      async () => {
        const headers = await getFunctionHeaders();
        const { data, error } = await supabase.functions.invoke(
          'update_queue_entry',
          {
            body: {
              queueEntryId: editEntry.queue_entry_id,
              fullName: editForm.fullName,
              email: editForm.email,
              phone: editForm.phone,
              serviceLabel: editForm.serviceLabel,
              customerType: editForm.customerType,
            },
            headers,
          }
        );
        if (error) throw error;
        if (data?.error) {
          throw new Error(data.error);
        }
      },
      { entryId: editEntry.queue_entry_id }
    );

    if (success) {
      const updated = await fetchHistoryEntry(editEntry.queue_entry_id);
      if (updated) {
        setHistoryEntries((prev) => sortHistoryEntries(upsertEntry(prev, updated)));
      }
      setEditEntry(null);
      setEditForm(null);
    }
  }, [
    editEntry,
    editForm,
    applyOptimisticEdit,
    fetchHistoryEntry,
    runOptimisticAction,
    getFunctionHeaders,
  ]);

  const handleLocationSelect = useCallback(
    (locationId: string) => {
      const selected = locationOptions.find(
        (location) => location.id === locationId
      );
      if (!selected) return;
      setIsLocationMenuOpen(false);
      setSelectedLocationId(locationId);
      router.push(`/employee/${selected.slug}`);
    },
    [locationOptions, router]
  );

  const handleAnalyticsSelect = useCallback(() => {
    setIsLocationMenuOpen(false);
    router.push('/employee/analytics');
  }, [router]);

  const openLocationMenu = useCallback(() => {
    setIsLocationMenuOpen(true);
  }, []);

  const closeLocationMenu = useCallback(() => {
    setIsLocationMenuOpen(false);
  }, []);

  const toggleLocationMenu = useCallback(() => {
    setIsLocationMenuOpen((prev) => !prev);
  }, []);

  if (authLoading) {
    return <LoadingSpinner text="Loading employee access..." className="mt-20" />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <ResponsiveCard className="w-full max-w-md">
          <h1 className="text-2xl font-libre-baskerville mb-4 text-center">
            Employee Sign In
          </h1>
          <form className="space-y-4" onSubmit={handleSignIn}>
            <label className="block text-sm">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
              />
            </label>
            {authError ? <p className="text-sm text-red-200">{authError}</p> : null}
            <Button type="submit" fullWidth>
              Sign In
            </Button>
          </form>
        </ResponsiveCard>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <ResponsiveCard className="w-full max-w-md">
          <h1 className="text-2xl font-libre-baskerville mb-4 text-center">
            Access Denied
          </h1>
          <p className="text-sm text-center">
            Your account does not have employee access.
          </p>
          <Button className="mt-4" fullWidth onClick={handleSignOut}>
            Sign Out
          </Button>
        </ResponsiveCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 py-8">
      {!isLocationMenuOpen ? (
        <div className="fixed left-4 top-8 z-50">
          <button
            type="button"
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onMouseEnter={openLocationMenu}
            onFocus={openLocationMenu}
            onClick={toggleLocationMenu}
            aria-label="Open locations menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
      ) : null}
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-libre-baskerville">
                {selectedLocation?.display_name
                  ? `${selectedLocation.display_name} · `
                  : ''}
                Employee Dashboard
              </h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
          <p className="text-sm text-white/80">
            Signed in as {currentUser.email} ({profile?.role})
          </p>
          {actionError ? (
            <p className="text-sm text-red-200">{actionError}</p>
          ) : null}
        </header>

        {dataLoading ? (
          <LoadingSpinner text="Loading queue..." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div onDragOver={handleDragOver} onDrop={handleDrop('waiting')}>
              <ResponsiveCard className="h-full min-h-[calc(100vh-260px)]">
                <div className="mb-3 flex items-center justify-between">
                  <Heading className="text-white">Waiting</Heading>
                  <button
                    type="button"
                    className="rounded-full bg-white/20 p-1 text-white transition hover:bg-white/30"
                    onClick={handleOpenCreateEntry}
                    aria-label="Add customer to queue"
                    title="Add customer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                </div>
                {waitingEntries.length === 0 ? (
                  <p className="text-sm text-white/70">No waiting customers.</p>
                ) : (
              <div className="space-y-4">
                  {waitingEntries.map((entry) => (
                    <WaitingEntryCard
                      key={entry.queue_entry_id}
                      entry={entry}
                      isServingBusy={busyAction === `serving:${entry.queue_entry_id}`}
                      isCancelBusy={busyAction === `cancel:${entry.queue_entry_id}`}
                      isDeleteBusy={busyAction === `delete:${entry.queue_entry_id}`}
                      hasUnread={Boolean(unreadEntryIds[entry.queue_entry_id])}
                      onDragStart={handleDragStart(entry.queue_entry_id, entry.status)}
                      onContextMenu={handleEntryContextMenu(entry.queue_entry_id)}
                      onAdvance={handleSetServing}
                      onOpenChat={openChat}
                      menuOpen={menuEntryId === entry.queue_entry_id}
                      canMove={canMoveEntry(entry)}
                      onCloseMenu={closeMenu}
                      onMove={handleOpenMove}
                      onEdit={handleOpenEdit}
                      onDelete={handleDeleteFromMenu}
                    />
                  ))}
              </div>
            )}
          </ResponsiveCard>
            </div>

            <div onDragOver={handleDragOver} onDrop={handleDrop('serving')}>
              <ResponsiveCard title="Serving" className="h-full min-h-[calc(100vh-260px)]">
                {servingEntries.length === 0 ? (
                  <p className="text-sm text-white/70">No active services.</p>
                ) : (
              <div className="space-y-4">
                  {servingEntries.map((entry) => (
                    <ServingEntryCard
                      key={entry.queue_entry_id}
                      entry={entry}
                      isCompleteBusy={busyAction === `complete:${entry.queue_entry_id}`}
                      isReturnBusy={busyAction === `return:${entry.queue_entry_id}`}
                      isCancelBusy={busyAction === `cancel:${entry.queue_entry_id}`}
                      isDeleteBusy={busyAction === `delete:${entry.queue_entry_id}`}
                      hasUnread={Boolean(unreadEntryIds[entry.queue_entry_id])}
                      onDragStart={handleDragStart(entry.queue_entry_id, entry.status)}
                      onContextMenu={handleEntryContextMenu(entry.queue_entry_id)}
                      onAdvance={handleComplete}
                      onOpenChat={openChat}
                      menuOpen={menuEntryId === entry.queue_entry_id}
                      canMove={canMoveEntry(entry)}
                      onCloseMenu={closeMenu}
                      onMove={handleOpenMove}
                      onEdit={handleOpenEdit}
                      onDelete={handleDeleteFromMenu}
                    />
                  ))}
              </div>
            )}
          </ResponsiveCard>
            </div>

            <div onDragOver={handleDragOver} onDrop={handleDrop('history')}>
              <ResponsiveCard title="History" className="h-full min-h-[calc(100vh-260px)]">
                {historyEntries.length === 0 ? (
                  <p className="text-sm text-white/70">No recent history.</p>
                ) : (
              <div className="space-y-3">
                  {historyEntries.map((entry) => (
                    <HistoryEntryCard
                      key={entry.queue_entry_id}
                      entry={entry}
                      isDeleteBusy={busyAction === `delete:${entry.queue_entry_id}`}
                      hasUnread={Boolean(unreadEntryIds[entry.queue_entry_id])}
                      onDragStart={handleDragStart(entry.queue_entry_id, entry.status)}
                      onContextMenu={handleEntryContextMenu(entry.queue_entry_id)}
                      onDelete={handleDeleteFromMenu}
                      onOpenChat={openChat}
                      onToggleMenu={handleToggleMenu}
                      onCloseMenu={closeMenu}
                      menuOpen={menuEntryId === entry.queue_entry_id}
                      canMove={canMoveEntry(entry)}
                      onMove={handleOpenMove}
                      onEdit={handleOpenEdit}
                    />
                  ))}
              </div>
            )}
          </ResponsiveCard>
        </div>
          </div>
        )}
      </div>
      <div
        className={`fixed inset-0 z-40 ${
          isLocationMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${
            isLocationMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeLocationMenu}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-white/10 bg-[#1f241f] p-5 transition-transform ${
            isLocationMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onMouseEnter={openLocationMenu}
          onMouseLeave={closeLocationMenu}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Locations</h2>
          </div>
          <div className="mt-4 space-y-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleAnalyticsSelect}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-white hover:bg-white/10"
              >
                <p className="text-sm font-semibold">Analytics</p>
              </button>
            ) : null}
            {locationOptions.length === 0 ? (
              <p className="text-sm text-white/70">No locations available.</p>
            ) : (
              locationOptions.map((location) => {
                const isActive = location.id === selectedLocationId;
                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => handleLocationSelect(location.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left ${
                      isActive
                        ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100'
                        : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {location.display_name}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>
      {moveEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <ResponsiveCard className="w-full max-w-md space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Move customer</h2>
                <p className="text-sm text-white/70">
                  Move {moveEntry.full_name ?? 'this customer'} to another location.
                </p>
              </div>
              <button
                type="button"
                className="rounded bg-white/10 px-3 py-1 text-sm"
                onClick={handleCloseMove}
              >
                Close
              </button>
            </div>
            {moveLocationOptions.length === 0 ? (
              <p className="text-sm text-white/70">
                No other locations available at this airport.
              </p>
            ) : (
              <label className="block text-sm">
                Target location
                <select
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={moveTargetLocationId}
                  onChange={(event) => setMoveTargetLocationId(event.target.value)}
                >
                  {moveLocationOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.display_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCloseMove}>
                Cancel
              </Button>
              <Button
                onClick={handleMoveSubmit}
                disabled={
                  !moveTargetLocationId ||
                  busyAction === `move:${moveEntry.queue_entry_id}`
                }
              >
                {busyAction === `move:${moveEntry.queue_entry_id}`
                  ? 'Moving...'
                  : 'Move'}
              </Button>
            </div>
          </ResponsiveCard>
        </div>
      ) : null}
      {editEntry && editForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={handleCloseEdit}
        >
          <ResponsiveCard
            className="w-full max-w-lg space-y-4 !bg-[#2f352f] !backdrop-blur-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Edit customer</h2>
                <p className="text-sm text-white/70">
                  Update contact info and treatment selection.
                </p>
              </div>
              <button
                type="button"
                className="rounded bg-white/10 px-3 py-1 text-sm"
                onClick={handleCloseEdit}
              >
                Close
              </button>
            </div>
            <div className="grid gap-3">
              <label className="block text-sm">
                Name
                <input
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={editForm.fullName}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, fullName: event.target.value } : prev
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, email: event.target.value } : prev
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, phone: event.target.value } : prev
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Treatment
                <select
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={editForm.serviceLabel}
                  onChange={(event) => {
                    const selectedLabel = event.target.value;
                    const option = TREATMENT_OPTIONS.find(
                      (item) => item.label === selectedLabel
                    );
                    setEditForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            serviceLabel: selectedLabel,
                            customerType: option?.customerType ?? prev.customerType,
                          }
                        : prev
                    );
                  }}
                >
                  {TREATMENT_OPTIONS.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={handleCloseEdit}>
                Cancel
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={busyAction === `edit:${editEntry.queue_entry_id}`}
              >
                {busyAction === `edit:${editEntry.queue_entry_id}`
                  ? 'Saving...'
                  : 'Save'}
              </Button>
            </div>
          </ResponsiveCard>
        </div>
      ) : null}
      {createEntryOpen && createForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={handleCloseCreateEntry}
        >
          <ResponsiveCard
            className="w-full max-w-lg space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Add customer</h2>
                <p className="text-sm text-white/70">
                  Create a new queue entry for this location.
                </p>
              </div>
              <button
                type="button"
                className="rounded bg-white/10 px-3 py-1 text-sm"
                onClick={handleCloseCreateEntry}
              >
                Close
              </button>
            </div>
            <div className="grid gap-3">
              <label className="block text-sm">
                Name
                <input
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={createForm.fullName}
                  onChange={(event) =>
                    setCreateForm((prev) =>
                      prev ? { ...prev, fullName: event.target.value } : prev
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((prev) =>
                      prev ? { ...prev, email: event.target.value } : prev
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={createForm.phone}
                  onChange={(event) =>
                    setCreateForm((prev) =>
                      prev ? { ...prev, phone: event.target.value } : prev
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Treatment
                <select
                  className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
                  value={createForm.serviceLabel}
                  onChange={(event) => {
                    const selectedLabel = event.target.value;
                    const option = TREATMENT_OPTIONS.find(
                      (item) => item.label === selectedLabel
                    );
                    setCreateForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            serviceLabel: selectedLabel,
                            customerType: option?.customerType ?? prev.customerType,
                          }
                        : prev
                    );
                  }}
                >
                  {TREATMENT_OPTIONS.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.consent}
                  onChange={(event) =>
                    setCreateForm((prev) =>
                      prev ? { ...prev, consent: event.target.checked } : prev
                    )
                  }
                />
                Consent confirmed by customer
              </label>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={handleCloseCreateEntry}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={busyAction === 'create-entry'}
              >
                {busyAction === 'create-entry' ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </ResponsiveCard>
        </div>
      ) : null}
      {historyDecisionEntryId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={handleCloseHistoryDecision}
        >
          <ResponsiveCard
            className="w-full max-w-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between gap-3">
              <Button
                className="flex-1 bg-red-600 text-white hover:bg-red-700"
                onClick={() => void handleConfirmHistoryDecision('canceled')}
                disabled={
                  busyAction === `cancel:${historyDecisionEntryId}` ||
                  busyAction === `complete:${historyDecisionEntryId}`
                }
              >
                {busyAction === `cancel:${historyDecisionEntryId}`
                  ? 'Canceling...'
                  : 'Canceled'}
              </Button>
              <Button
                className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => void handleConfirmHistoryDecision('completed')}
                disabled={
                  busyAction === `cancel:${historyDecisionEntryId}` ||
                  busyAction === `complete:${historyDecisionEntryId}`
                }
              >
                {busyAction === `complete:${historyDecisionEntryId}`
                  ? 'Completing...'
                  : 'Completed'}
              </Button>
            </div>
          </ResponsiveCard>
        </div>
      ) : null}
      {chatEntry ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={closeChat}
        >
          <ResponsiveCard
            className="w-full max-w-2xl space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex items-start justify-center">
              <div className="text-center">
                <h2 className="text-xl font-semibold">
                  {chatEntry.full_name ?? 'Customer'}
                </h2>
                <p className="text-xs text-white/70">
                  {chatEntry.service_label ?? 'Service'} ·{' '}
                  {chatEntry.phone_e164 ?? 'No phone on file'}
                </p>
              </div>
              <button
                type="button"
                className="absolute right-0 top-0 rounded bg-white/10 px-3 py-1 text-sm"
                onClick={closeChat}
              >
                Close
              </button>
            </div>

            <div
              ref={chatListRef}
              className="h-80 space-y-3 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-3"
            >
              {chatMessages.length === 0 ? (
                <p className="text-sm text-white/70">No messages yet.</p>
              ) : (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.direction === 'out'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                        message.direction === 'out'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p className="mt-1 text-[10px] text-white/70">
                        {formatTime(message.at)}
                        {message.direction === 'out' && message.status
                          ? ` · ${message.status}`
                          : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {chatError ? (
              <p className="text-xs text-red-200">{chatError}</p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <textarea
                className="min-h-[80px] w-full rounded-md bg-white text-black px-3 py-2"
                placeholder="Type a message..."
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
              />
              <Button
                className="shrink-0 min-w-[7.5rem]"
                onClick={handleSendMessage}
                disabled={chatSending || !chatDraft.trim()}
              >
                {chatSending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </ResponsiveCard>
        </div>
      ) : null}
    </div>
  );
}
