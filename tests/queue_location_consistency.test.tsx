/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useQueueData } from '@/app/employee/[location]/hooks/useQueueData';
import { useEntryActions } from '@/app/employee/[location]/hooks/useEntryActions';

type Pending = { table: string; location: string; resolve: (value: unknown) => void };
const mockPending: Pending[] = [];
jest.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({
  from: (table: string) => {
    let location = '';
    const finish = () => new Promise(resolve => mockPending.push({ table, location, resolve }));
    const query = { select: () => query, eq: (key: string, value: string) => { if (key === 'location_id') location = value; return query; }, maybeSingle: finish, order: finish };
    return query;
  },
}) }));

async function finish(requests: Pending[], error = false) {
  await act(async () => {
    for (const request of requests) request.resolve({ error: error ? { message: 'synthetic failure' } : null, data: request.table === 'queues' ? { id: `queue-${request.location}` } : request.table.includes('waiting') ? [{ queue_entry_id: `entry-${request.location}`, queue_position: 1, created_at: '2026-09-05T00:00:00Z' }] : [] });
  });
}

beforeEach(() => { mockPending.length = 0; });

it.each([false, true])('new location survives a late prior response (error=%s)', async error => {
  const onActionError = jest.fn();
  const { result, rerender } = renderHook(({ location }) => useQueueData({ selectedLocationId: location, debugEnabled: false, onActionError }), { initialProps: { location: 'A' } });
  rerender({ location: 'B' });
  await finish(mockPending.filter(request => request.location === 'B'));
  expect(result.current.queueId).toBe('queue-B');
  onActionError.mockClear();
  await finish(mockPending.filter(request => request.location === 'A'), error);
  expect(result.current.queueId).toBe('queue-B');
  expect(result.current.waitingEntries[0]?.queue_entry_id).toBe('entry-B');
  expect(result.current.dataLoading).toBe(false);
  expect(onActionError).not.toHaveBeenCalled();
});

it('coalesces a refresh burst and reads again after the in-flight snapshot', async () => {
  const { result } = renderHook(() => useQueueData({ selectedLocationId: 'A', debugEnabled: false }));
  const initial = [...mockPending];
  let refresh: Promise<void>;
  act(() => {
    refresh = result.current.refreshQueueData();
    for (let index = 0; index < 20; index++) expect(result.current.refreshQueueData()).toBe(refresh);
  });
  expect(mockPending).toHaveLength(4);
  await finish(initial);
  expect(mockPending).toHaveLength(7);
  await act(async () => {
    for (const request of mockPending.slice(initial.length)) request.resolve({ error: null, data: request.table.includes('history') ? [{ queue_entry_id: 'completed-A', end_ts: '2026-10-09T12:00:00Z' }] : [] });
    await refresh;
  });
  expect(result.current.dataLoading).toBe(false);
  expect(result.current.waitingEntries).toEqual([]);
  expect(result.current.historyEntries[0]?.queue_entry_id).toBe('completed-A');
});

it('recovers a missed queue change when the browser comes online', async () => {
  const { result } = renderHook(() => useQueueData({ selectedLocationId: 'A', debugEnabled: false }));
  await finish([...mockPending]);
  expect(result.current.waitingEntries).toHaveLength(1);
  const count = mockPending.length;
  act(() => { window.dispatchEvent(new Event('online')); });
  await act(async () => { for (const request of mockPending.slice(count)) request.resolve({ error: null, data: [] }); });
  expect(result.current.waitingEntries).toEqual([]);
});

it('ignores failed requests after unmount', async () => {
  const onActionError = jest.fn();
  const { unmount } = renderHook(() => useQueueData({ selectedLocationId: 'A', debugEnabled: false, onActionError }));
  unmount();
  onActionError.mockClear();
  await finish(mockPending, true);
  expect(onActionError).not.toHaveBeenCalled();
});

it('does not invoke or optimistically mutate an unresolved queue context', async () => {
  const invokeEmployeeFunction = jest.fn();
  const optimistic = jest.fn();
  const refreshQueueData = jest.fn();
  const setActionError = jest.fn();
  const queueState = { applyOptimisticServing: optimistic, applyOptimisticHistory: optimistic, applyOptimisticWaiting: optimistic, applyOptimisticRemoval: optimistic, removeEntryFromLists: optimistic, fetchWaitingEntry: jest.fn(), refreshQueueData, setWaitingEntries: jest.fn() };
  const { result } = renderHook(() => useEntryActions({ queueId: null, currentUserId: 'synthetic-staff', selectedLocationId: 'B', setActionError, queueState, invokeEmployeeFunction }));
  await act(async () => {
    await result.current.handleSetServing('old-A-entry');
    expect(await result.current.runAction('synthetic-edit', invokeEmployeeFunction)).toBe(false);
  });
  expect(optimistic).not.toHaveBeenCalled();
  expect(invokeEmployeeFunction).not.toHaveBeenCalled();
  expect(refreshQueueData).not.toHaveBeenCalled();
  expect(setActionError).not.toHaveBeenCalled();
  expect(result.current.busyAction).toBeNull();
});

it('keeps an action error visible during a successful queue reconciliation', async () => {
  const onActionError = jest.fn();
  const { result } = renderHook(() => useQueueData({ selectedLocationId: 'A', debugEnabled: false, onActionError }));
  await finish([...mockPending]);
  onActionError.mockClear();
  const count = mockPending.length;
  let refresh: Promise<void>;
  act(() => { refresh = result.current.refreshQueueData({ clearActionError: false }); });
  await finish(mockPending.slice(count));
  await refresh!;
  expect(onActionError).not.toHaveBeenCalled();
});

it('reconciles failed staff moves without clearing the failure message', async () => {
  const setActionError = jest.fn();
  const refreshQueueData = jest.fn().mockResolvedValue(undefined);
  const queueState = { applyOptimisticServing: jest.fn(), applyOptimisticHistory: jest.fn(), applyOptimisticWaiting: jest.fn(), applyOptimisticRemoval: jest.fn(), removeEntryFromLists: jest.fn(), fetchWaitingEntry: jest.fn(), refreshQueueData, setWaitingEntries: jest.fn() };
  const invokeEmployeeFunction = jest.fn().mockRejectedValue(new Error('Synthetic move denied'));
  const { result } = renderHook(() => useEntryActions({ queueId: 'queue-A', currentUserId: 'synthetic-staff', selectedLocationId: 'A', setActionError, queueState, invokeEmployeeFunction }));
  await act(async () => { await result.current.handleSetServing('entry-A'); });
  expect(setActionError).toHaveBeenLastCalledWith('Synthetic move denied');
  expect(refreshQueueData).toHaveBeenCalledWith(expect.objectContaining({ clearActionError: false }));
});
