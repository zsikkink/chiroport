import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'npm:zod@3.25.76';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { errorResponse } from '../_shared/httpError.ts';
import { MESSAGE_TYPES } from '../_shared/messages.ts';
import {
  isSettledOutboxResult,
  sendOutboxForEntry,
} from '../_shared/outbox.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { getLocationIdForQueueEntry } from '../_shared/queue.ts';

const payloadSchema = z.object({ queueEntryId: z.string().uuid() });

serve(async (req) => {
  const origin = req.headers.get('origin');
  const path = new URL(req.url).pathname;
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin, path) });
  }

  if (req.method !== 'POST') {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }

  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse('validation_error', 'Invalid payload', 400, headers);
  }
  const payload = parsed.data;

  if (!payload.queueEntryId) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
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
    withCorsHeaders(headers, origin, path);
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
      withCorsHeaders(headers, origin, path);
      return buildRateLimitResponse({
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        headers,
        origin,
        path,
      });
    }
  }
  // Compatibility endpoint: retain the deployed HTTP shape but delegate the
  // transition, audit event, and durable outbox write to the canonical command.
  const { data: rows, error } = await service.rpc('staff_queue_entry_action', {
    p_entry_id: payload.queueEntryId,
    p_action: 'serving',
    p_target_location_id: null,
    p_actor_user_id: userId,
    p_departure_reason: null,
  });
  const data = rows?.[0];

  if (error) {
    console.error('set_serving update failed', {
      error,
      queueEntryId: payload.queueEntryId,
    });
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to set serving' }),
      { status: 403, headers }
    );
  }

  if (!data?.out_queue_entry_id) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(
      JSON.stringify({
        error: 'Queue entry not found or not in waiting status',
      }),
      { status: 409, headers }
    );
  }

  try {
    const delivery = await sendOutboxForEntry(
      service,
      data.out_queue_entry_id,
      MESSAGE_TYPES.SERVING
    );
    if (!isSettledOutboxResult(delivery)) {
      console.error('set_serving immediate send incomplete', {
        queueEntryId: data.out_queue_entry_id,
        delivery,
      });
    }
  } catch (error) {
    console.error('set_serving immediate send failed', error);
  }

  const headers = new Headers();
  withCorsHeaders(headers, origin, path);
  return new Response(
    JSON.stringify({
      queueEntryId: data.out_queue_entry_id,
      status: data.out_status,
      servedAt: new Date().toISOString(),
    }),
    { status: 200, headers }
  );
});
