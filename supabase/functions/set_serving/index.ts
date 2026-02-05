import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { MESSAGE_TYPES, buildServingNotification } from '../_shared/messages.ts';
import { enqueueAndSendOutboxMessage } from '../_shared/outbox.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { getLocationIdForQueueEntry } from '../_shared/queue.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }

  let payload: { queueEntryId?: string } = {};
  try {
    payload = (await req.json()) as { queueEntryId?: string };
  } catch {
    payload = {};
  }

  if (!payload.queueEntryId) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Queue entry id is required' }), {
      status: 400,
      headers,
    });
  }

  let auth;
  try {
    auth = await requireEmployee(authHeader);
  } catch (error) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unauthorized' }),
      { status: 403, headers }
    );
  }

  const { service, userId } = auth;
  const locationId = await getLocationIdForQueueEntry(
    service,
    payload.queueEntryId
  );
  if (locationId) {
    const rateLimit = await checkRateLimit(
      service,
      [
        {
          bucket: `user:${userId}`,
          limit: getRateLimitConfig('RATE_LIMIT_EMPLOYEE_USER_PER_MIN', 300),
          windowSeconds: 60,
        },
        {
          bucket: `location:${locationId}`,
          limit: getRateLimitConfig('RATE_LIMIT_EMPLOYEE_LOCATION_PER_MIN', 1000),
          windowSeconds: 60,
        },
      ],
      { endpoint: 'set_serving', logContext: { userId, locationId }, failOpen: false }
    );

    if (!rateLimit.allowed) {
      const headers = new Headers();
      withCorsHeaders(headers, origin);
      return buildRateLimitResponse({
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        headers,
        origin,
      });
    }
  }
  const nowIso = new Date().toISOString();

  const { data, error } = await service
    .from('queue_entries')
    .update({ status: 'serving', served_at: nowIso })
    .eq('id', payload.queueEntryId)
    .in('status', ['waiting'])
    .select('id, status, served_at')
    .maybeSingle();

  if (error) {
    console.error('set_serving update failed', {
      error,
      queueEntryId: payload.queueEntryId,
    });
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to set serving' }),
      { status: 403, headers }
    );
  }

  if (!data) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(
      JSON.stringify({
        error: 'Queue entry not found or not in waiting status',
      }),
      { status: 409, headers }
    );
  }

  try {
    const { data: entry, error: entryError } = await service
      .from('queue_entries')
      .select('id, customer_type, customer:customers(phone_e164)')
      .eq('id', data.id)
      .maybeSingle();
    if (entryError) throw entryError;

    const phone =
      typeof entry?.customer === 'object' && entry?.customer
        ? (entry.customer as { phone_e164?: string }).phone_e164
        : null;
    if (entry?.id && phone) {
      await enqueueAndSendOutboxMessage(service, {
        queue_entry_id: entry.id,
        message_type: MESSAGE_TYPES.SERVING,
        to_phone: phone,
        body: buildServingNotification(),
        status: 'queued',
        idempotency_key: `serving:${entry.id}`,
      });
    }
  } catch (error) {
    console.error('set_serving immediate send failed', error);
  }

  const headers = new Headers();
  withCorsHeaders(headers, origin);
  return new Response(
    JSON.stringify({
      queueEntryId: data.id,
      status: data.status,
      servedAt: data.served_at,
    }),
    { status: 200, headers }
  );
});
