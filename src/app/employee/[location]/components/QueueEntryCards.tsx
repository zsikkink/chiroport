import { memo, type DragEvent, type MouseEvent } from 'react';
import type {
  ChatEntry,
  HistoryRow,
  MenuEntry,
  ServingRow,
  WaitingRow,
  WithEntryId,
} from '../types';
import {
  formatConfirmSmsStatus,
  formatServingSmsStatus,
  formatSmsStatus,
  formatStatusLabel,
  formatTime,
  formatWaitedLabel,
  toChatEntry,
} from '../utils';
import { EntryActions } from './EntryActions';

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

export const WaitingEntryCard = memo(function WaitingEntryCard({
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
            className="rounded-md border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
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
          <EntryActions
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
        <span className={nextStatus.className}>Next SMS: {nextStatus.label}</span>
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
  isReturnBusy: boolean;
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

export const ServingEntryCard = memo(function ServingEntryCard({
  entry,
  isCompleteBusy,
  isReturnBusy,
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
            className="rounded-md border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
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
          <EntryActions
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

export const HistoryEntryCard = memo(function HistoryEntryCard({
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
          <EntryActions
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
