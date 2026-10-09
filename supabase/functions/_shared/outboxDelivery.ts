export type OutboxRow = {
  id: string;
  queue_entry_id: string;
  attempt_count: number;
  message_type: string;
  to_phone: string;
  body: string;
};

export type OutboxSendResult =
  | { status: 'sent'; providerMessageId: string | null; alreadySent?: boolean }
  | { status: 'durably_queued'; reason: 'rate_limited' | 'already_claimed' }
  | {
      status: 'retryable_failure';
      code: string;
      error: string;
      providerAccepted?: boolean;
      providerMessageId?: string | null;
    }
  | { status: 'permanent_failure'; code: string; error: string }
  | { status: 'opted_out' }
  | { status: 'missing' };

export type ProviderSendResult = {
  ok: boolean;
  messageId: string | null;
  error: string | null;
};

export type OutboxDeliveryStore = {
  isOptedOut: (phone: string) => Promise<boolean>;
  isMessageCurrent: (message: OutboxRow) => Promise<boolean>;
  updateMessage: (
    messageId: string,
    payload: Record<string, unknown>,
    operation: string
  ) => Promise<void>;
  checkRateLimit: (message: OutboxRow) => Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>;
  normalizeBody: (message: OutboxRow) => string;
  sendSms: (to: string, body: string) => Promise<ProviderSendResult>;
};

const MAX_ATTEMPTS = 8;
const BASE_DELAY_SECONDS = 60;
const MAX_DELAY_SECONDS = 60 * 60;

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function computeNextAttempt(attemptCount: number) {
  const exponent = Math.max(attemptCount - 1, 0);
  const delaySeconds = Math.min(
    BASE_DELAY_SECONDS * 2 ** exponent,
    MAX_DELAY_SECONDS
  );
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

async function persistFailure(
  store: OutboxDeliveryStore,
  message: OutboxRow,
  failure: string
) {
  const isDead = message.attempt_count >= MAX_ATTEMPTS;
  await store.updateMessage(
    message.id,
    {
      status: isDead ? 'dead' : 'failed',
      last_error: failure,
      locked_at: null,
      next_attempt_at: isDead
        ? new Date().toISOString()
        : computeNextAttempt(message.attempt_count),
    },
    'mark outbox failure'
  );
  return isDead;
}

async function recordRetryableFailure(
  store: OutboxDeliveryStore,
  message: OutboxRow,
  code: string,
  failure: string
): Promise<OutboxSendResult> {
  try {
    const isDead = await persistFailure(store, message, failure);
    return isDead
      ? { status: 'permanent_failure', code, error: failure }
      : { status: 'retryable_failure', code, error: failure };
  } catch (persistenceError) {
    const persistenceMessage = errorMessage(
      persistenceError,
      'Failed to persist outbox failure'
    );
    console.error('[sms_outbox] failure state persistence failed', {
      outboxId: message.id,
      code,
      failure,
      persistenceError,
    });
    return {
      status: 'retryable_failure',
      code: 'failure_persistence_failed',
      error: `${failure}; ${persistenceMessage}`,
    };
  }
}

export function mapOutboxRowLookup(
  row: OutboxRow | null,
  error: unknown
): OutboxSendResult | null {
  if (error) {
    return {
      status: 'retryable_failure',
      code: 'outbox_lookup_failed',
      error: errorMessage(error, 'Failed to load durable outbox row'),
    };
  }
  return row ? null : { status: 'missing' };
}

export function isSettledOutboxResult(result: OutboxSendResult) {
  return ['sent', 'durably_queued', 'opted_out'].includes(result.status);
}

export async function deliverClaimedMessage(
  store: OutboxDeliveryStore,
  message: OutboxRow
): Promise<OutboxSendResult> {
  if (!message.body || !message.to_phone) {
    try {
      await store.updateMessage(
        message.id,
        {
          status: 'dead',
          last_error: 'Missing body or to_phone',
          locked_at: null,
          next_attempt_at: new Date().toISOString(),
        },
        'mark invalid outbox row'
      );
      return {
        status: 'permanent_failure',
        code: 'invalid_outbox_row',
        error: 'Missing body or to_phone',
      };
    } catch (error) {
      return {
        status: 'retryable_failure',
        code: 'failure_persistence_failed',
        error: errorMessage(error, 'Failed to persist invalid outbox row'),
      };
    }
  }

  let optedOut: boolean;
  try {
    optedOut = await store.isOptedOut(message.to_phone);
  } catch (error) {
    return recordRetryableFailure(
      store,
      message,
      'opt_out_lookup_failed',
      errorMessage(error, 'Opt-out lookup failed')
    );
  }

  if (optedOut) {
    try {
      await store.updateMessage(
        message.id,
        {
          status: 'dead',
          last_error: 'opted_out',
          locked_at: null,
          next_attempt_at: new Date().toISOString(),
        },
        'mark opted-out message'
      );
      return { status: 'opted_out' };
    } catch (error) {
      return {
        status: 'retryable_failure',
        code: 'opt_out_persistence_failed',
        error: errorMessage(error, 'Failed to persist opt-out result'),
      };
    }
  }

  const rateLimit = await store.checkRateLimit(message);
  if (!rateLimit.allowed) {
    try {
      await store.updateMessage(
        message.id,
        {
          status: 'queued',
          last_error: 'rate_limited',
          locked_at: null,
          next_attempt_at: new Date(
            Date.now() + rateLimit.retryAfterSeconds * 1000
          ).toISOString(),
        },
        'mark rate-limited message'
      );
      return { status: 'durably_queued', reason: 'rate_limited' };
    } catch (error) {
      return {
        status: 'retryable_failure',
        code: 'rate_limit_persistence_failed',
        error: errorMessage(error, 'Failed to persist rate limit'),
      };
    }
  }

  // Delayed automated messages must still describe the authoritative visit.
  // This is a last check before provider I/O; a subsequent state change or an
  // ambiguous provider acceptance still requires operator reconciliation.
  try {
    if (!(await store.isMessageCurrent(message))) {
      await store.updateMessage(message.id, {
        status: 'dead', last_error: 'superseded_queue_state', locked_at: null,
      }, 'mark superseded message');
      return { status: 'permanent_failure', code: 'superseded_queue_state', error: 'Visit state changed before delivery.' };
    }
  } catch (error) {
    return recordRetryableFailure(store, message, 'queue_state_lookup_failed',
      errorMessage(error, 'Failed to validate current visit state'));
  }

  const finalBody = store.normalizeBody(message);
  // Persist even an unchanged body: the real adapter verifies that this claim
  // still owns a live row before an external side effect is attempted.
  {
    try {
      await store.updateMessage(
        message.id,
        { body: finalBody },
        'persist normalized SMS body'
      );
    } catch (error) {
      return recordRetryableFailure(
        store,
        message,
        'body_persistence_failed',
        errorMessage(error, 'Failed to persist normalized SMS body')
      );
    }
  }

  let providerResult: ProviderSendResult;
  try {
    providerResult = await store.sendSms(message.to_phone, finalBody);
  } catch (error) {
    return recordRetryableFailure(
      store,
      message,
      'provider_unavailable',
      errorMessage(error, 'Twilio send failed')
    );
  }

  if (!providerResult.ok) {
    return recordRetryableFailure(
      store,
      message,
      'provider_rejected',
      providerResult.error ?? 'Twilio send failed'
    );
  }

  try {
    await store.updateMessage(
      message.id,
      {
        status: 'sent',
        provider_message_id: providerResult.messageId,
        sent_at: new Date().toISOString(),
        locked_at: null,
        last_error: null,
        next_attempt_at: new Date().toISOString(),
      },
      'mark provider-accepted message sent'
    );
  } catch (error) {
    const persistenceError = errorMessage(
      error,
      'Provider accepted SMS but sent status could not be persisted'
    );
    console.error('[sms_outbox] provider accepted but sent persistence failed', {
      outboxId: message.id,
      queueEntryId: message.queue_entry_id,
      providerMessageId: providerResult.messageId,
      persistenceError,
    });
    return {
      status: 'retryable_failure',
      code: 'sent_persistence_failed',
      error: persistenceError,
      providerAccepted: true,
      providerMessageId: providerResult.messageId,
    };
  }

  return { status: 'sent', providerMessageId: providerResult.messageId };
}
