import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { enqueueAndSendOutboxMessage } from '../_shared/outbox.ts';
import { MESSAGE_TYPES, buildServingNotification } from '../_shared/messages.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { getLocationIdForQueueEntry } from '../_shared/queue.ts';

const ALLOWED_ACTIONS = new Set([
  'complete',
  'cancel',
  'return',
  'delete',
  'move',
  'serving',
]);

type Payload = {
  queueEntryId?: string;
  action?: string;
  targetLocationId?: string;
};

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

  let payload: Payload = {};
  try {
    payload = (await req.json()) as Payload;
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

  if (!payload.action || !ALLOWED_ACTIONS.has(payload.action)) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Action is invalid' }), {
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

  const locationId =
    payload.targetLocationId ||
    (await getLocationIdForQueueEntry(service, payload.queueEntryId));

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
      {
        endpoint: 'queue_entry_action',
        logContext: { userId, locationId, action: payload.action },
        failOpen: false,
      }
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

  let result;
  try {
    const { data, error } = await service.rpc('staff_queue_entry_action', {
      p_entry_id: payload.queueEntryId,
      p_action: payload.action,
      p_target_location_id: payload.targetLocationId ?? null,
      p_actor_user_id: userId,
    });
    if (error) throw error;
    result = data?.[0];
    if (!result?.out_queue_entry_id) {
      throw new Error('Queue entry action failed');
    }
  } catch (error) {
    const err = error as { message?: string; details?: string; hint?: string };
    const message = [err.message, err.details, err.hint].filter(Boolean).join(' | ') ||
      'Action failed';
    console.error('queue_entry_action failed', error);
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers,
    });
  }

  if (payload.action === 'serving' && result?.out_customer_type === 'paying') {
    try {
      const { data: customerRow } = await service
        .from('customers')
        .select('phone_e164, full_name')
        .eq('id', result.out_customer_id)
        .maybeSingle();
      if (customerRow?.phone_e164) {
        await enqueueAndSendOutboxMessage(service, {
          queue_entry_id: result.out_queue_entry_id,
          message_type: MESSAGE_TYPES.SERVING,
          to_phone: customerRow.phone_e164,
          body: buildServingNotification(),
          status: 'queued',
          idempotency_key: `serving:${result.out_queue_entry_id}`,
        });
      }
    } catch (error) {
      console.error('queue_entry_action immediate send failed', error);
    }
  }

  const headers = new Headers();
  withCorsHeaders(headers, origin);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
});
