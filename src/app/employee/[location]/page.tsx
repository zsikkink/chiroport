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
import { ResponsiveCard, Button, LoadingSpinner, Heading } from '@/components/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireEnv } from '@/lib/supabase/helpers';
import { toLocationSlug } from '@/lib/locationSlug';
import { TREATMENT_OPTIONS } from '@/domain/services/catalog';
import { useChatData } from './hooks/useChatData';
import { useEmployeePresence } from './hooks/useEmployeePresence';
import { useEntryActions } from './hooks/useEntryActions';
import { useQueueData } from './hooks/useQueueData';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';
import type {
  ChatEntry,
  CreateFormState,
  DragPayload,
  EditFormState,
  HistoryRow,
  LocationOption,
  MenuEntry,
  ServingRow,
  WaitingRow,
  WithEntryId,
} from './types';
import {
  formatConfirmSmsStatus,
  formatServingSmsStatus,
  formatSmsStatus,
  formatStatusLabel,
  formatTime,
  formatWaitedLabel,
  toChatEntry,
} from './utils';

const supabase = getSupabaseBrowserClient();

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

export default function EmployeeDashboardPage() {
  const [actionError, setActionError] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
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

  const {
    currentUser,
    authLoading,
    authError,
    profile,
    accessDenied,
    locations,
    handleSignIn,
    handleSignOut,
  } = useEmployeePresence({ onActionError: setActionError });

  const debugEnabled = process.env.NODE_ENV !== 'production';
  const renderCountRef = useRef(0);

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
  }, [locationOptions, moveEntry]);
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

  useEffect(() => {
    renderCountRef.current += 1;
    if (debugEnabled) {
      console.debug(`[employee] render #${renderCountRef.current}`);
    }
  });

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
  }, [locationOptions, locationParam, router, selectedLocationId]);

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

      if (
        result.parsed &&
        typeof result.parsed === 'object' &&
        'error' in result.parsed
      ) {
        const errorValue = (result.parsed as { error?: string }).error;
        if (errorValue) {
          throw new Error(errorValue);
        }
      }
      return result.parsed;
    },
    [getFunctionHeaders]
  );

  const queueData = useQueueData({
    selectedLocationId,
    debugEnabled,
    onActionError: setActionError,
  });

  const {
    queueId,
    waitingEntries,
    servingEntries,
    historyEntries,
    dataLoading,
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
  } = queueData;

  const {
    chatEntry,
    chatMessages,
    chatError,
    chatDraft,
    chatSending,
    unreadEntryIds,
    chatListRef,
    chatEntryRef,
    setChatDraft,
    openChat,
    closeChat,
    handleSendMessage,
    setChatMessages,
    setUnreadEntryIds,
  } = useChatData({ invokeEmployeeFunction });

  useRealtimeSubscriptions(
    {
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
    },
    {
      chatEntryRef,
      setChatMessages,
      setUnreadEntryIds,
    }
  );

  const {
    busyAction,
    runOptimisticAction,
    handleSetServing,
    handleComplete,
    handleCancel,
    handleReturnToQueue,
    handleDelete,
    handleMoveSubmit: handleMoveSubmitAction,
    handleCreateSubmit: handleCreateSubmitAction,
    handleEditSubmit: handleEditSubmitAction,
  } = useEntryActions({
    currentUserId: currentUser?.id ?? null,
    queueId,
    selectedLocationId,
    setActionError,
    queueState: queueData,
    invokeEmployeeFunction,
    getFunctionHeaders,
  });

  const handleDeleteWithChat = useCallback(
    (entryId: string) => {
      void handleDelete(entryId, () => {
        if (chatEntryRef.current?.queue_entry_id === entryId) {
          closeChat();
        }
      });
    },
    [chatEntryRef, closeChat, handleDelete]
  );

  const handleDeleteFromMenu = useCallback(
    (entryId: string) => {
      setMenuEntryId(null);
      handleDeleteWithChat(entryId);
    },
    [handleDeleteWithChat]
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
    const success = await handleMoveSubmitAction({
      entryId: moveEntry.queue_entry_id,
      targetLocationId: moveTargetLocationId,
    });

    if (success) {
      setMoveEntry(null);
      setMoveTargetLocationId('');
    }
  }, [handleMoveSubmitAction, moveEntry, moveTargetLocationId]);

  const handleCreateSubmit = useCallback(async () => {
    if (!createForm) return;
    const success = await handleCreateSubmitAction({
      form: createForm,
      selectedLocation,
    });

    if (success) {
      handleCloseCreateEntry();
    }
  }, [createForm, handleCloseCreateEntry, handleCreateSubmitAction, selectedLocation]);

  const handleEditSubmit = useCallback(async () => {
    if (!editEntry || !editForm) return;
    const success = await handleEditSubmitAction({
      entryId: editEntry.queue_entry_id,
      form: editForm,
    });

    if (success) {
      setEditEntry(null);
      setEditForm(null);
    }
  }, [editEntry, editForm, handleEditSubmitAction]);

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
            () => queueData.applyOptimisticServing(payload.entryId),
            async () => {
              await invokeEmployeeFunction('queue_entry_action', {
                action: 'serving',
                queueEntryId: payload.entryId,
              });
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
      handleReturnToQueue,
      handleSetServing,
      invokeEmployeeFunction,
      queueData,
      runOptimisticAction,
    ]
  );

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
        <header
          className={`flex flex-col gap-3 ${!isLocationMenuOpen ? 'pl-16' : ''}`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="hidden sm:block" />
            <h1 className="text-center text-3xl font-libre-baskerville">
              Employee Dashboard
              {selectedLocation?.display_name
                ? ` · ${selectedLocation.display_name}`
                : ''}
            </h1>
            <div className="flex justify-center sm:justify-end">
              <Button variant="secondary" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
          <p className="text-center text-sm text-white/80">
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
