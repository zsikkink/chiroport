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
  attemptCount: number,
  claimedBody: string
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
    update.gte('locked_at', new Date(now - 5 * 60_000).toISOString()).eq('body', claimedBody);
  }
  const { error } = await update.select('id').single();
  if (error) {
    throw new Error(`${operation}: ${errorMessage(error, 'database update failed')}`);
  }
}

async function buildDeliveryStore(
  supabase: SupabaseClient,
  dependencies: OutboxDependencies,
  attemptCount: number,
  claimedBody: string
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
      updateMessage(supabase, messageId, payload, operation, attemptCount, claimedBody),
    async isMessageCurrent(message) {
      const expectedStatuses: Record<string, string[]> = {
        next: ['waiting'], serving: ['serving'],
        cancel_ack: ['cancelled'], cancel_reason_prompt: ['cancelled'],
      };
      const statuses = expectedStatuses[message.message_type];
      if (!statuses) return true; // Confirmation is also the prerequisite for cancellation delivery.
      const { data: entry, error } = await supabase.from('queue_entries')
        .select('status,queue_id').eq('id', message.queue_entry_id).maybeSingle();
      if (error) throw new Error('Current visit lookup failed');
      if (!entry || !statuses.includes(entry.status)) return false;
      if (message.message_type !== 'next') return true;
      const { data: events, error: eventError } = await supabase.from('queue_events')
        .select('event_type,payload').eq('queue_entry_id', message.queue_entry_id)
        .in('event_type', ['next_notified', 'moved_by_staff'])
        .order('created_at', { ascending: false });
      if (eventError) throw new Error('Notification context lookup failed');
      const notification = events?.find(event => event.event_type === 'next_notified');
      const queueId = notification?.payload?.queue_id;
      // Legacy notifications have no queue identity. They remain compatible
      // until a move makes their original location unsafe to infer.
      return queueId ? queueId === entry.queue_id : !events?.some(event => event.event_type === 'moved_by_staff');
    },
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
  const store = await buildDeliveryStore(supabase, dependencies, message.attempt_count, message.body);
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
    .select('id, queue_entry_id, attempt_count, message_type, to_phone, body, status, provider_message_id, last_error')
    .eq('queue_entry_id', queueEntryId)
    .eq('message_type', messageType)
    .maybeSingle();
  const lookupResult = mapOutboxRowLookup(row as OutboxRow | null, rowError);
  if (lookupResult) return lookupResult;
  if (row?.status === 'sent') {
    return { status: 'sent', providerMessageId: row.provider_message_id, alreadySent: true };
  }
  if (row?.status === 'dead') {
    return row.last_error === 'opted_out'
      ? { status: 'opted_out' }
      : { status: 'permanent_failure', code: 'outbox_dead', error: 'Message requires operator review before replay.' };
  }

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
