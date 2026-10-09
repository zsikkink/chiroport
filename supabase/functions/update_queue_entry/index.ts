import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'npm:zod@3.25.76';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { normalizePhoneToE164 } from '../_shared/phone.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { getLocationIdForQueueEntry } from '../_shared/queue.ts';
import { errorResponse } from '../_shared/httpError.ts';

const payloadSchema = z.object({
  queueEntryId: z.string().uuid(),
  fullName: z.string().optional(),
  email: z.string().trim().email().or(z.literal('')).optional(),
  phone: z.string(),
  offeringCode: z.string().optional(),
  // Keep the older employee UI's label field during a rolling deployment.
  serviceLabel: z.string().optional(),
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

  const requestedOfferingCode = payload.offeringCode?.trim();
  const legacyServiceLabel = payload.serviceLabel?.trim();
  if (!requestedOfferingCode && !legacyServiceLabel) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      'validation_error',
      'Service offering is required',
      400,
      headers
    );
  }

  const phoneE164 = normalizePhoneToE164(payload.phone ?? '');
  if (!phoneE164) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      'validation_error',
      'Valid phone number is required',
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
      { endpoint: 'update_queue_entry', logContext: { userId, locationId }, failOpen: false }
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

  const fullName = payload.fullName?.trim() || null;
  const email = payload.email?.trim().toLowerCase() || null;
  let offeringCode = requestedOfferingCode;
  if (!offeringCode && legacyServiceLabel) {
    const { data: legacyOffering, error: legacyOfferingError } = await service
      .from('service_offerings')
      .select('code')
      .eq('display_label', legacyServiceLabel)
      .eq('is_active', true)
      .maybeSingle();
    if (legacyOfferingError || !legacyOffering?.code) {
      const headers = new Headers();
      withCorsHeaders(headers, origin, path);
      return errorResponse(
        'validation_error',
        'Service offering is invalid',
        400,
        headers
      );
    }
    offeringCode = legacyOffering.code;
  }

  const { data: updatedRows, error: updateError } = await service.rpc(
    'staff_edit_queue_entry',
    {
      p_entry_id: payload.queueEntryId,
      p_actor_user_id: userId,
      p_full_name: fullName,
      p_email: email,
      p_phone_e164: phoneE164,
      p_offering_code: offeringCode ?? '',
    }
  );

  if (updateError || !updatedRows?.length) {
    console.error('update_queue_entry command failed', {
      code: updateError?.code ?? 'missing_result',
      queueEntryId: payload.queueEntryId,
    });
    const message = updateError?.code === 'P0001'
      ? updateError.message
      : 'Queue entry could not be updated. Please try again.';
    const expectedConflict =
      updateError?.code === 'P0001' || updateError?.code === '23505';
    const publicMessage = updateError?.code === '23505'
      ? 'Phone number already in use.'
      : message;
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      expectedConflict ? 'conflict' : 'dependency_unavailable',
      publicMessage,
      expectedConflict ? 409 : 503,
      headers
    );
  }

  const headers = new Headers();
  withCorsHeaders(headers, origin, path);
  return new Response(JSON.stringify({ success: true, entry: updatedRows[0] }), {
    status: 200,
    headers,
  });
});
