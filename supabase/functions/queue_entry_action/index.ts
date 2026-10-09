import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'npm:zod@3.25.76';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import {
  isSettledOutboxResult,
  sendOutboxForEntry,
} from '../_shared/outbox.ts';
import { MESSAGE_TYPES } from '../_shared/messages.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { getLocationIdForQueueEntry } from '../_shared/queue.ts';
import { errorResponse } from '../_shared/httpError.ts';

const ALLOWED_ACTIONS = new Set([
  'complete',
  'cancel',
  'return',
  'delete',
  'move',
  'serving',
]);

const payloadSchema = z.object({
  queueEntryId: z.string().uuid(),
  action: z.enum(['complete', 'cancel', 'return', 'delete', 'move', 'serving']),
  targetLocationId: z.string().uuid().nullish(),
  departureReason: z.string().nullish(),
});

const DEPARTURE_REASONS = new Set([
  'priority_pass_declined',
  'no_staff_available',
  'customer_left',
  'other',
]);

serve(async (req) => {
  const origin = req.headers.get('origin');
  const path = new URL(req.url).pathname;
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin, path) });
  }

  if (req.method !== 'POST') {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse('validation_error', 'Method not allowed', 405, headers);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse('unauthorized', 'Unauthorized', 401, headers);
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
    return errorResponse(
      'validation_error',
      'Queue entry id is required',
      400,
      headers
    );
  }

  if (!payload.action || !ALLOWED_ACTIONS.has(payload.action)) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse('validation_error', 'Action is invalid', 400, headers);
  }

  if (payload.departureReason != null &&
    (payload.action !== 'cancel' || !DEPARTURE_REASONS.has(payload.departureReason))) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse('validation_error', 'Cancellation reason is invalid', 400, headers);
  }

  let auth;
  try {
    auth = await requireEmployee(authHeader);
  } catch (error) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      'forbidden',
      error instanceof Error ? error.message : 'Forbidden',
      403,
      headers
    );
  }

  const { service, userId, role } = auth;

  if (payload.action === 'delete' && role !== 'admin') {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      'forbidden',
      'Admin access is required',
      403,
      headers
    );
  }

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
      withCorsHeaders(headers, origin, path);
      return buildRateLimitResponse({
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        headers,
        origin,
        path,
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
      p_departure_reason: payload.departureReason ?? null,
    });
    if (error) throw error;
    result = data?.[0];
    if (!result?.out_queue_entry_id) {
      throw new Error('Queue entry action failed');
    }
  } catch (error) {
    const err = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    const message = err.code === 'P0001'
      ? err.message || 'Action failed'
      : 'Queue action could not be completed. Refresh the queue before retrying.';
    console.error('queue_entry_action failed', { code: err.code ?? 'unknown', action: payload.action, queueEntryId: payload.queueEntryId });
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    const expectedDomainError = err.code === 'P0001';
    return errorResponse(
      expectedDomainError ? 'invalid_transition' : 'dependency_unavailable',
      message,
      expectedDomainError ? 409 : 503,
      headers
    );
  }

  if (payload.action === 'serving') {
    try {
      const delivery = await sendOutboxForEntry(
        service,
        result.out_queue_entry_id,
        MESSAGE_TYPES.SERVING
      );
      if (!isSettledOutboxResult(delivery)) {
        console.error('queue_entry_action immediate send incomplete', {
          queueEntryId: result.out_queue_entry_id,
          delivery,
        });
      }
    } catch (error) {
      console.error('queue_entry_action immediate send failed', error);
    }
  }

  const headers = new Headers();
  withCorsHeaders(headers, origin, path);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
});
