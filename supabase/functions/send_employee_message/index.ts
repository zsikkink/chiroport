import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'npm:zod@3.25.76';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { sendOutboxForEntry } from '../_shared/outbox.ts';
import { mapStaffMessageOutcome } from '../_shared/staffMessageOutcome.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { getLocationIdForQueueEntry } from '../_shared/queue.ts';
import { errorResponse } from '../_shared/httpError.ts';

const payloadSchema = z.object({
  queueEntryId: z.string().uuid(),
  body: z.string().trim().min(1),
  requestId: z.string().uuid().optional(),
});

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

  const messageBody = payload.body?.trim() ?? '';
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

  if (!messageBody) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      'validation_error',
      'Message body is required',
      400,
      headers
    );
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
    { endpoint: 'send_employee_message', logContext: { userId, locationId }, failOpen: false }
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

  const { data: queuedRows, error: queueError } = await service.rpc(
    'staff_enqueue_message',
    {
      p_entry_id: payload.queueEntryId,
      p_actor_user_id: userId,
      p_body: messageBody,
      ...(payload.requestId ? { p_request_id: payload.requestId } : {}),
    }
  );
  const queued = queuedRows?.[0];
  if (queueError || !queued?.out_outbox_id || !queued.out_message_type) {
    console.error('send_employee_message durable enqueue failed', {
      code: queueError?.code ?? 'missing_result',
      queueEntryId: payload.queueEntryId,
    });
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      queueError?.code === 'P0001' ? 'conflict' : 'dependency_unavailable',
      queueError?.code === 'P0001' ? queueError.message : 'Message could not be durably queued.',
      queueError?.code === 'P0001' ? 409 : 503,
      headers
    );
  }

  const delivery = await sendOutboxForEntry(
    service,
    payload.queueEntryId,
    queued.out_message_type
  );

  if (delivery.status === 'sent' && !delivery.alreadySent) {
    const { error: eventError } = await service.from('queue_events').insert({
      queue_entry_id: payload.queueEntryId,
      actor_user_id: userId,
      event_type: 'staff_message_sent',
      payload: {
        outbox_id: queued.out_outbox_id,
        provider_message_id: delivery.providerMessageId,
      },
    });
    if (eventError) {
      console.error('send_employee_message sent audit persistence failed', {
        error: eventError,
        queueEntryId: payload.queueEntryId,
        outboxId: queued.out_outbox_id,
        providerMessageId: delivery.providerMessageId,
      });
      const headers = new Headers();
      withCorsHeaders(headers, origin, path);
      return new Response(
        JSON.stringify({
          error: {
            code: 'dependency_unavailable',
            message: 'Message was accepted by the provider, but its audit event could not be recorded.',
          },
          outcome: 'sent_unrecorded',
        }),
        { status: 500, headers }
      );
    }

  }

  if (!['sent', 'durably_queued', 'opted_out'].includes(delivery.status)) {
    console.error('send_employee_message delivery did not complete', {
      queueEntryId: payload.queueEntryId,
      outboxId: queued.out_outbox_id,
      delivery,
    });
  }

  const outcome = mapStaffMessageOutcome(delivery);
  const headers = new Headers();
  withCorsHeaders(headers, origin, path);
  return new Response(
    JSON.stringify(outcome.body),
    { status: outcome.status, headers }
  );
});
