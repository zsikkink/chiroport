/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useChatData } from '@/app/employee/[location]/hooks/useChatData';
import type { ChatEntry } from '@/app/employee/[location]/types';
import { ApiBoundaryError } from '@/lib/apiError';

type Pending = { table: string; entryId: string; resolve: (value: unknown) => void };
const mockPending: Pending[] = [];
jest.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({
  from: (table: string) => {
    let entryId = '';
    const query = {
      select: () => query,
      eq: (_key: string, value: string) => { entryId = value; return query; },
      order: () => new Promise(resolve => mockPending.push({ table, entryId, resolve })),
    };
    return query;
  },
}) }));

const entry = (id: string): ChatEntry => ({ queue_entry_id: id, full_name: id, phone_e164: '+12025550123', service_label: 'Chiropractor', created_at: '2026-10-09T12:00:00Z' });
async function finish(requests: Pending[], error = false, body = 'synthetic message') {
  await act(async () => {
    for (const request of requests) request.resolve({ error: error ? { message: 'synthetic failure' } : null, data: request.table === 'sms_inbound' ? [{ id: request.entryId, body, received_at: '2026-10-09T12:00:00Z' }] : [] });
  });
}

beforeEach(() => {
  mockPending.length = 0;
  let sequence = 0;
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: jest.fn(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`) });
});

it('allows a new unchanged message after a definite opt-out rejection and subsequent opt-in', async () => {
  const invokeEmployeeFunction = jest.fn(async (name: string, body: Record<string, unknown>) => {
    void name; void body;
    throw new ApiBoundaryError({ code: 'opted_out', message: 'Recipient opted out' }, 409);
  });
  const { result } = renderHook(() => useChatData({ invokeEmployeeFunction }));
  act(() => { void result.current.openChat(entry('A')); });
  await finish(mockPending);
  act(() => { result.current.setChatDraft('unchanged draft'); });
  await act(async () => { await result.current.handleSendMessage(); });
  await act(async () => { await result.current.handleSendMessage(); });
  expect(invokeEmployeeFunction.mock.calls[0]?.[1].requestId).not.toBe(invokeEmployeeFunction.mock.calls[1]?.[1].requestId);
});

it.each([false, true])('a delayed chat A result cannot replace chat B (error=%s)', async error => {
  const { result } = renderHook(() => useChatData({ invokeEmployeeFunction: jest.fn() }));
  act(() => { void result.current.openChat(entry('A')); });
  const old = [...mockPending];
  act(() => { void result.current.openChat(entry('B')); });
  await finish(mockPending.slice(old.length));
  await finish(old, error);
  expect(result.current.chatEntry?.queue_entry_id).toBe('B');
  expect(result.current.chatMessages[0]?.id).toBe('inbound:B');
  expect(result.current.chatError).toBe('');
  expect(result.current.chatLoading).toBe(false);
});

it('closing chat invalidates a pending open and pending refresh', async () => {
  const { result } = renderHook(() => useChatData({ invokeEmployeeFunction: jest.fn() }));
  act(() => { void result.current.openChat(entry('A')); });
  act(() => { result.current.closeChat(); });
  await finish(mockPending);
  expect(result.current.chatEntry).toBeNull();
  expect(result.current.chatMessages).toEqual([]);
  expect(result.current.chatLoading).toBe(false);
});

it('a newer refresh wins over an older response in the same conversation', async () => {
  const { result } = renderHook(() => useChatData({ invokeEmployeeFunction: jest.fn() }));
  act(() => { void result.current.openChat(entry('A')); });
  const old = [...mockPending];
  act(() => { void result.current.reloadActiveChat(); });
  await finish(mockPending.slice(old.length), false, 'newer');
  await finish(old, false, 'older');
  expect(result.current.chatMessages[0]?.body).toBe('newer');
});

it.each([false, true])('a completed send from old chat cannot clear the new draft or set its error (error=%s)', async failed => {
  let resolve!: (value: Record<string, unknown>) => void;
  let reject!: (reason: Error) => void;
  const invokeEmployeeFunction = jest.fn(() => new Promise<Record<string, unknown>>((yes, no) => { resolve = yes; reject = no; }));
  const { result } = renderHook(() => useChatData({ invokeEmployeeFunction }));
  act(() => { void result.current.openChat(entry('A')); });
  await finish(mockPending);
  act(() => { result.current.setChatDraft('message for A'); });
  act(() => { void result.current.handleSendMessage(); });
  act(() => { void result.current.openChat(entry('B')); });
  act(() => { result.current.setChatDraft('draft for B'); });
  await act(async () => { if (failed) reject(new Error('old send failed')); else resolve({ success: true }); });
  expect(invokeEmployeeFunction).toHaveBeenCalledWith('send_employee_message', expect.objectContaining({ queueEntryId: 'A', body: 'message for A' }));
  expect(result.current.chatEntry?.queue_entry_id).toBe('B');
  expect(result.current.chatDraft).toBe('draft for B');
  expect(result.current.chatError).toBe('');
  expect(result.current.chatSending).toBe(false);
  await finish(mockPending.filter(request => request.entryId === 'B'));
});

it('blocks double clicks and reuses the same request ID after an ambiguous failure', async () => {
  let reject!: (reason: Error) => void;
  const invokeEmployeeFunction = jest.fn(() => new Promise<Record<string, unknown>>((_yes, no) => { reject = no; }));
  const { result } = renderHook(() => useChatData({ invokeEmployeeFunction }));
  act(() => { void result.current.openChat(entry('A')); });
  await finish(mockPending);
  act(() => { result.current.setChatDraft('retry this once'); });
  act(() => { void result.current.handleSendMessage(); void result.current.handleSendMessage(); });
  expect(invokeEmployeeFunction).toHaveBeenCalledTimes(1);
  await act(async () => { reject(new Error('response was lost')); });
  act(() => { void result.current.handleSendMessage(); });
  expect(invokeEmployeeFunction).toHaveBeenCalledTimes(2);
  expect(invokeEmployeeFunction.mock.calls[1]).toEqual(invokeEmployeeFunction.mock.calls[0]);
  await act(async () => { reject(new Error('still unavailable')); });
});
