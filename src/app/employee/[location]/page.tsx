'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ResponsiveCard, Button, LoadingSpinner } from '@/components/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireEnv } from '@/lib/supabase/helpers';
import { toLocationSlug } from '@/lib/locationSlug';
import { TREATMENT_OPTIONS } from '@/domain/services/catalog';
import { useChatData } from './hooks/useChatData';
import { useEmployeePresence } from './hooks/useEmployeePresence';
import { useEntryActions } from './hooks/useEntryActions';
import { useQueueData } from './hooks/useQueueData';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';
import { ChatPanel } from './components/ChatPanel';
import { QueueColumn } from './components/QueueColumn';
import { StatusBar } from './components/StatusBar';
import {
  HistoryEntryCard,
  ServingEntryCard,
  WaitingEntryCard,
} from './components/QueueEntryCards';
import type {
  CreateFormState,
  DragPayload,
  EditFormState,
  LocationOption,
  MenuEntry,
} from './types';

const supabase = getSupabaseBrowserClient();

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
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 sm:px-8 py-8">
      {!isLocationMenuOpen ? (
        <div className="fixed left-4 top-8 z-50">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-100"
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
        <StatusBar
          locationName={selectedLocation?.display_name ?? null}
          userEmail={currentUser.email ?? null}
          role={profile?.role ?? null}
          actionError={actionError}
          onSignOut={handleSignOut}
          offsetForMenu={!isLocationMenuOpen}
        />

        {dataLoading ? (
          <LoadingSpinner text="Loading queue..." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <QueueColumn
              title="Waiting"
              emptyLabel="No waiting customers."
              isEmpty={waitingEntries.length === 0}
              onDragOver={handleDragOver}
              onDrop={handleDrop('waiting')}
              headerAction={
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white p-1 text-slate-700 transition hover:bg-slate-50"
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
              }
            >
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
            </QueueColumn>

            <QueueColumn
              title="Serving"
              emptyLabel="No active services."
              isEmpty={servingEntries.length === 0}
              onDragOver={handleDragOver}
              onDrop={handleDrop('serving')}
              useCardTitle
            >
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
            </QueueColumn>

            <QueueColumn
              title="History"
              emptyLabel="No recent history."
              isEmpty={historyEntries.length === 0}
              onDragOver={handleDragOver}
              onDrop={handleDrop('history')}
              useCardTitle
              itemsClassName="space-y-3"
            >
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
            </QueueColumn>
          </div>
        )}
      </div>
      <div
        className={`fixed inset-0 z-40 ${
          isLocationMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-slate-900/20 transition-opacity ${
            isLocationMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeLocationMenu}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-slate-200 bg-white p-5 transition-transform ${
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
                className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-left text-blue-700 hover:bg-blue-100"
              >
                <p className="text-sm font-semibold">Analytics</p>
              </button>
            ) : null}
            {locationOptions.length === 0 ? (
              <p className="text-sm text-slate-500">No locations available.</p>
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
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <ResponsiveCard className="w-full max-w-md space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Move customer</h2>
                <p className="text-sm text-slate-500">
                  Move {moveEntry.full_name ?? 'this customer'} to another location.
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                onClick={handleCloseMove}
              >
                Close
              </button>
            </div>
            {moveLocationOptions.length === 0 ? (
              <p className="text-sm text-slate-500">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={handleCloseEdit}
        >
          <ResponsiveCard
            className="w-full max-w-lg space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Edit customer</h2>
                <p className="text-sm text-slate-500">
                  Update contact info and treatment selection.
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={handleCloseCreateEntry}
        >
          <ResponsiveCard
            className="w-full max-w-lg space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Add customer</h2>
                <p className="text-sm text-slate-500">
                  Create a new queue entry for this location.
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={handleCloseHistoryDecision}
        >
          <ResponsiveCard
            className="w-full max-w-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between gap-3">
              <Button
                className="flex-1 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
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
                className="flex-1 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
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
        <ChatPanel
          chatEntry={chatEntry}
          chatMessages={chatMessages}
          chatError={chatError}
          chatDraft={chatDraft}
          chatSending={chatSending}
          onClose={closeChat}
          onSend={handleSendMessage}
          onDraftChange={setChatDraft}
          listRef={chatListRef}
        />
      ) : null}
    </div>
  );
}
