import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withCorsHeaders, corsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { enqueueAndSendOutboxMessage } from '../_shared/outbox.ts';

type Payload = {
  queueEntryId?: string;
  body?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }

  let payload: Payload = {};
  try {
    payload = (await req.json()) as Payload;
  } catch {
    payload = {};
  }

  const messageBody = payload.body?.trim() ?? '';
  if (!payload.queueEntryId) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Queue entry id is required' }), {
      status: 400,
      headers,
    });
  }

  if (!messageBody) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Message body is required' }), {
      status: 400,
      headers,
    });
  }

  let auth;
  try {
    auth = await requireEmployee(authHeader);
  } catch (error) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unauthorized' }),
      { status: 403, headers }
    );
  }

  const { service } = auth;

  const { data: entry, error: entryError } = await service
    .from('queue_entries')
    .select('id, customer:customers(phone_e164)')
    .eq('id', payload.queueEntryId)
    .maybeSingle();

  if (entryError) {
    console.error('send_employee_message lookup failed', {
      error: entryError,
      queueEntryId: payload.queueEntryId,
    });
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: entryError.message || 'Unable to load queue entry' }),
      { status: 403, headers }
    );
  }

  const phone =
    typeof entry?.customer === 'object' && entry?.customer
      ? (entry.customer as { phone_e164?: string }).phone_e164
      : null;

  if (!entry?.id || !phone) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: 'Customer phone number is missing' }),
      { status: 409, headers }
    );
  }

  const messageType = `staff_${crypto.randomUUID()}`;
  const idempotencyKey = `staff:${entry.id}:${crypto.randomUUID()}`;

  try {
    await enqueueAndSendOutboxMessage(service, {
      queue_entry_id: entry.id,
      message_type: messageType,
      to_phone: phone,
      body: messageBody,
      status: 'queued',
      idempotency_key: idempotencyKey,
    });
  } catch (error) {
    console.error('send_employee_message failed', error);
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: 'Failed to send message' }),
      { status: 500, headers }
    );
  }

  await service.from('queue_events').insert({
    queue_entry_id: entry.id,
    actor_user_id: null,
    event_type: 'staff_message_sent',
    payload: { to_phone: phone },
  });

  const headers = new Headers();
  withCorsHeaders(headers);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
});
