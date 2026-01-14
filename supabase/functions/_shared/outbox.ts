import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1?target=deno';
import { sendTwilioSms } from './twilio.ts';

type OutboxRow = {
  id: string;
  attempt_count: number;
  to_phone: string;
  body: string;
};

const MAX_ATTEMPTS = 8;
const BASE_DELAY_SECONDS = 60;
const MAX_DELAY_SECONDS = 60 * 60;

function computeNextAttempt(attemptCount: number) {
  const exponent = Math.max(attemptCount - 1, 0);
  const delaySeconds = Math.min(BASE_DELAY_SECONDS * 2 ** exponent, MAX_DELAY_SECONDS);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

async function markFailed(
  supabase: SupabaseClient,
  message: OutboxRow,
  errorMessage: string
) {
  const isDead = message.attempt_count >= MAX_ATTEMPTS;
  const payload = {
    status: isDead ? 'dead' : 'failed',
    last_error: errorMessage,
    locked_at: null,
    next_attempt_at: isDead ? new Date().toISOString() : computeNextAttempt(message.attempt_count),
  };

  await supabase.from('sms_outbox').update(payload).eq('id', message.id);
}

async function markOptedOut(supabase: SupabaseClient, message: OutboxRow) {
  await supabase
    .from('sms_outbox')
    .update({
      status: 'dead',
      last_error: 'opted_out',
      locked_at: null,
      next_attempt_at: new Date().toISOString(),
    })
    .eq('id', message.id);
}

async function isOptedOut(supabase: SupabaseClient, phone: string) {
  const { data, error } = await supabase
    .from('sms_opt_outs')
    .select('id')
    .eq('phone_e164', phone)
    .maybeSingle();
  if (error) {
    return false;
  }
  return Boolean(data?.id);
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
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function sendClaimedMessage(
  supabase: SupabaseClient,
  message: OutboxRow
) {
  if (!message.body || !message.to_phone) {
    await markFailed(supabase, message, 'Missing body or to_phone');
    return { status: 'failed', error: 'Missing body or to_phone' };
  }

  if (await isOptedOut(supabase, message.to_phone)) {
    await markOptedOut(supabase, message);
    return { status: 'dead', error: 'opted_out' };
  }

  try {
    const { response, payload } = await sendTwilioSms({
      to: message.to_phone,
      body: message.body,
    });

    if (!response.ok) {
      const errorMessage = payload?.message ?? 'Twilio send failed';
      await markFailed(supabase, message, errorMessage);
      return { status: 'failed', error: errorMessage };
    }

    await supabase
      .from('sms_outbox')
      .update({
        status: 'sent',
        provider_message_id: payload?.sid ?? null,
        sent_at: new Date().toISOString(),
        locked_at: null,
        last_error: null,
        next_attempt_at: new Date().toISOString(),
      })
      .eq('id', message.id);

    return { status: 'sent' };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await markFailed(supabase, message, errorMessage);
    return { status: 'failed', error: errorMessage };
  }
}

export async function enqueueAndSendOutboxMessage(
  supabase: SupabaseClient,
  payload: {
    queue_entry_id: string;
    message_type: string;
    to_phone: string;
    body: string;
    status: string;
    idempotency_key: string;
  }
) {
  await supabase
    .from('sms_outbox')
    .upsert(payload, { onConflict: 'queue_entry_id,message_type', ignoreDuplicates: true });

  const { data: row } = await supabase
    .from('sms_outbox')
    .select('id, attempt_count, to_phone, body')
    .eq('idempotency_key', payload.idempotency_key)
    .maybeSingle();

  if (!row) {
    return { status: 'missing' };
  }

  const claimed = await claimOutboxMessage(supabase, row.id);
  if (!claimed) {
    return { status: 'skipped' };
  }

  return sendClaimedMessage(supabase, claimed as OutboxRow);
}

export async function sendOutboxForEntry(
  supabase: SupabaseClient,
  queueEntryId: string,
  messageType: string
) {
  const { data: row } = await supabase
    .from('sms_outbox')
    .select('id, attempt_count, to_phone, body')
    .eq('queue_entry_id', queueEntryId)
    .eq('message_type', messageType)
    .maybeSingle();

  if (!row) {
    return { status: 'missing' };
  }

  const claimed = await claimOutboxMessage(supabase, row.id);
  if (!claimed) {
    return { status: 'skipped' };
  }

  return sendClaimedMessage(supabase, claimed as OutboxRow);
}
