import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1?target=deno';
import { sendTwilioSms } from './twilio.ts';
import { checkRateLimit, getRateLimitConfig } from './rateLimit.ts';
import { getLocationIdForQueueEntry } from './queue.ts';
import { buildFinalOutboundSmsBody } from './messages.ts';
import {
  deliverClaimedMessage,
  isSettledOutboxResult,
  mapOutboxRowLookup,
  type OutboxDeliveryStore,
  type OutboxRow,
  type OutboxSendResult,
} from './outboxDelivery.ts';

export {
  isSettledOutboxResult,
  type OutboxRow,
  type OutboxSendResult,
} from './outboxDelivery.ts';

export type OutboxDependencies = {
  sendSms?: typeof sendTwilioSms;
  checkLimit?: typeof checkRateLimit;
  getLimitConfig?: typeof getRateLimitConfig;
  getLocationId?: typeof getLocationIdForQueueEntry;
};

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function updateMessage(
  supabase: SupabaseClient,
  messageId: string,
  payload: Record<string, unknown>,
  operation: string,
  attemptCount: number
) {
  const preflight = operation === 'persist normalized SMS body';
  const now = Date.now();
  const update = supabase
    .from('sms_outbox')
    .update(preflight ? { ...payload, locked_at: new Date(now).toISOString() } : payload)
    .eq('id', messageId)
    .eq('status', 'sending')
    .eq('attempt_count', attemptCount);
  // The existing monotonic claim attempt is a fencing value. A stale worker
  // must not overwrite a later claim or treat a deleted row as persisted.
  if (preflight) {
    // Renew a still-valid lease before external I/O, not one already expired.
    update.gte('locked_at', new Date(now - 5 * 60_000).toISOString());
  }
  const { error } = await update.select('id').single();
  if (error) {
    throw new Error(`${operation}: ${errorMessage(error, 'database update failed')}`);
  }
}

async function buildDeliveryStore(
  supabase: SupabaseClient,
  dependencies: OutboxDependencies,
  attemptCount: number
): Promise<OutboxDeliveryStore> {
  const sendSms = dependencies.sendSms ?? sendTwilioSms;
  const checkLimit = dependencies.checkLimit ?? checkRateLimit;
  const getLimitConfig = dependencies.getLimitConfig ?? getRateLimitConfig;
  const getLocationId = dependencies.getLocationId ?? getLocationIdForQueueEntry;

  return {
    async isOptedOut(phone) {
      const { data, error } = await supabase
        .from('sms_opt_outs')
        .select('id')
        .eq('phone_e164', phone)
        .maybeSingle();
      if (error) throw new Error(errorMessage(error, 'Opt-out lookup failed'));
      return Boolean(data?.id);
    },
    updateMessage: (messageId, payload, operation) =>
      updateMessage(supabase, messageId, payload, operation, attemptCount),
    async checkRateLimit(message) {
      const rules = [
        {
          bucket: `sms:phone:${message.to_phone}:day`,
          limit: getLimitConfig('RATE_LIMIT_SMS_PHONE_PER_DAY', 5),
          windowSeconds: 60 * 60 * 24,
        },
      ];
      const locationId = message.queue_entry_id
        ? await getLocationId(supabase, message.queue_entry_id)
        : null;
      if (locationId) {
        rules.push({
          bucket: `sms:location:${locationId}:day`,
          limit: getLimitConfig('RATE_LIMIT_SMS_LOCATION_PER_DAY', 200),
          windowSeconds: 60 * 60 * 24,
        });
      }
      return checkLimit(supabase, rules, {
        endpoint: 'send_sms',
        logContext: { phone: message.to_phone, locationId },
        failOpen: false,
      });
    },
    normalizeBody(message) {
      return buildFinalOutboundSmsBody({
        body: message.body,
        messageType: message.message_type,
      });
    },
    async sendSms(to, body) {
      const { response, payload } = await sendSms({ to, body });
      return {
        ok: response.ok,
        messageId: typeof payload?.sid === 'string' ? payload.sid : null,
        error: typeof payload?.message === 'string' ? payload.message : null,
      };
    },
  };
}

export async function claimOutboxMessage(
  supabase: SupabaseClient,
  messageId: string
) {
  const { data, error } = await supabase.rpc('claim_sms_outbox', {
    p_limit: 1,
    p_lock_minutes: 5,
    p_message_id: messageId,
  });
  if (error) throw new Error(errorMessage(error, 'Outbox claim failed'));
  return data?.[0] ?? null;
}

export async function sendClaimedMessage(
  supabase: SupabaseClient,
  message: OutboxRow,
  dependencies: OutboxDependencies = {}
): Promise<OutboxSendResult> {
  const store = await buildDeliveryStore(supabase, dependencies, message.attempt_count);
  return deliverClaimedMessage(store, message);
}

export async function sendOutboxForEntry(
  supabase: SupabaseClient,
  queueEntryId: string,
  messageType: string,
  dependencies: OutboxDependencies = {}
): Promise<OutboxSendResult> {
  const { data: row, error: rowError } = await supabase
    .from('sms_outbox')
    .select('id, queue_entry_id, attempt_count, message_type, to_phone, body')
    .eq('queue_entry_id', queueEntryId)
    .eq('message_type', messageType)
    .maybeSingle();
  const lookupResult = mapOutboxRowLookup(row as OutboxRow | null, rowError);
  if (lookupResult) return lookupResult;

  let claimed: OutboxRow | null;
  try {
    claimed = (await claimOutboxMessage(supabase, row!.id)) as OutboxRow | null;
  } catch (error) {
    return {
      status: 'retryable_failure',
      code: 'outbox_claim_failed',
      error: errorMessage(error, 'Failed to claim durable outbox row'),
    };
  }
  if (!claimed) return { status: 'durably_queued', reason: 'already_claimed' };
  return sendClaimedMessage(supabase, claimed, dependencies);
}
