/** @jest-environment node */

import {
  deliverClaimedMessage,
  mapOutboxRowLookup,
  type OutboxDeliveryStore,
  type OutboxRow,
} from '../supabase/functions/_shared/outboxDelivery';
import { mapStaffMessageOutcome } from '../supabase/functions/_shared/staffMessageOutcome';

type StoreOptions = {
  optedOut?: boolean;
  optOutError?: Error;
  updateError?: (
    payload: Record<string, unknown>,
    operation: string
  ) => Error | null;
  providerResult?: {
    ok: boolean;
    messageId?: string | null;
    error?: string | null;
  };
};

function createStore(options: StoreOptions = {}) {
  const updates: Record<string, unknown>[] = [];
  const sendSms = jest.fn(async () => {
    const result = options.providerResult ?? {
      ok: true,
      messageId: 'SM123',
      error: null,
    };
    return {
      ok: result.ok,
      messageId: result.messageId ?? null,
      error: result.error ?? null,
    };
  });
  const store: OutboxDeliveryStore = {
    async isMessageCurrent() { return true; },
    async isOptedOut() {
      if (options.optOutError) throw options.optOutError;
      return options.optedOut ?? false;
    },
    async updateMessage(_messageId, payload, operation) {
      updates.push(payload);
      const error = options.updateError?.(payload, operation);
      if (error) throw error;
    },
    async checkRateLimit() {
      return { allowed: true, retryAfterSeconds: 0 };
    },
    normalizeBody(outboxMessage) {
      return outboxMessage.body;
    },
    sendSms,
  };
  return { store, updates, sendSms };
}

const message: OutboxRow = {
  id: 'outbox-1',
  queue_entry_id: 'entry-1',
  attempt_count: 1,
  message_type: 'staff_test',
  to_phone: '+15555550123',
  body: 'Hello',
};

describe('SMS outbox failure semantics', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('fails closed when opt-out eligibility cannot be loaded', async () => {
    const { store, updates, sendSms } = createStore({
      optOutError: new Error('database unavailable'),
    });
    const result = await deliverClaimedMessage(store, message);

    expect(sendSms).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'retryable_failure',
      code: 'opt_out_lookup_failed',
    });
    expect(updates.at(-1)).toMatchObject({ status: 'failed', locked_at: null });
  });

  it('marks an opted-out recipient dead without calling the provider', async () => {
    const { store, updates, sendSms } = createStore({ optedOut: true });
    const result = await deliverClaimedMessage(store, message);

    expect(sendSms).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'opted_out' });
    expect(updates.at(-1)).toMatchObject({
      status: 'dead',
      last_error: 'opted_out',
    });
  });

  it('persists a retryable transition after provider rejection', async () => {
    const { store, updates } = createStore({
      providerResult: { ok: false, error: 'rejected' },
    });
    const result = await deliverClaimedMessage(store, message);

    expect(result).toEqual({
      status: 'retryable_failure',
      code: 'provider_rejected',
      error: 'rejected',
    });
    expect(updates.at(-1)).toMatchObject({
      status: 'failed',
      last_error: 'rejected',
      locked_at: null,
    });
    expect(updates.at(-1)?.next_attempt_at).toEqual(expect.any(String));
  });

  it('surfaces failure-state persistence failure', async () => {
    const { store } = createStore({
      providerResult: { ok: false, error: 'provider rejected' },
      updateError: (payload, operation) =>
        payload.status === 'failed'
          ? new Error(`${operation}: write failed`)
          : null,
    });
    const result = await deliverClaimedMessage(store, message);

    expect(result).toMatchObject({
      status: 'retryable_failure',
      code: 'failure_persistence_failed',
    });
  });

  it('reports provider acceptance as ambiguous when sent persistence fails', async () => {
    const { store } = createStore({
      providerResult: { ok: true, messageId: 'SM123' },
      updateError: (payload, operation) =>
        payload.status === 'sent'
          ? new Error(`${operation}: write failed`)
          : null,
    });
    const result = await deliverClaimedMessage(store, message);

    expect(result).toEqual({
      status: 'retryable_failure',
      code: 'sent_persistence_failed',
      error: 'mark provider-accepted message sent: write failed',
      providerAccepted: true,
      providerMessageId: 'SM123',
    });
  });

  it('distinguishes missing rows from row lookup failures', () => {
    expect(mapOutboxRowLookup(null, null)).toEqual({ status: 'missing' });
    expect(
      mapOutboxRowLookup(null, { message: 'lookup failed' })
    ).toEqual({
      status: 'retryable_failure',
      code: 'outbox_lookup_failed',
      error: 'lookup failed',
    });
  });

  it('maps staff-visible outcomes without calling queued or failed work sent', () => {
    expect(
      mapStaffMessageOutcome({
        status: 'durably_queued',
        reason: 'rate_limited',
      })
    ).toMatchObject({ status: 202, body: { outcome: 'queued' } });
    expect(mapStaffMessageOutcome({ status: 'opted_out' })).toMatchObject({
      status: 409,
      body: { outcome: 'opted_out' },
    });
    expect(
      mapStaffMessageOutcome({
        status: 'retryable_failure',
        code: 'provider_unavailable',
        error: 'unavailable',
      })
    ).toMatchObject({
      status: 503,
      body: { outcome: 'retryable_failure' },
    });
  });
});
