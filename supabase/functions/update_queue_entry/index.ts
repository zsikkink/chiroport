import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { normalizePhoneToE164 } from '../_shared/phone.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { getLocationIdForQueueEntry } from '../_shared/queue.ts';

type Payload = {
  queueEntryId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  offeringCode?: string;
  // Kept during the rolling deployment so an older employee UI can still edit.
  serviceLabel?: string;
};

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

  let payload: Payload = {};
  try {
    payload = (await req.json()) as Payload;
  } catch {
    payload = {};
  }

  if (!payload.queueEntryId) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(JSON.stringify({ error: 'Queue entry id is required' }), {
      status: 400,
      headers,
    });
  }

  const requestedOfferingCode = payload.offeringCode?.trim();
  const legacyServiceLabel = payload.serviceLabel?.trim();
  if (!requestedOfferingCode && !legacyServiceLabel) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(JSON.stringify({ error: 'Service offering is required' }), {
      status: 400,
      headers,
    });
  }

  const phoneE164 = normalizePhoneToE164(payload.phone ?? '');
  if (!phoneE164) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(JSON.stringify({ error: 'Valid phone number is required' }), {
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
      return new Response(JSON.stringify({ error: 'Service offering is invalid' }), {
        status: 400,
        headers,
      });
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
      error: updateError,
      queueEntryId: payload.queueEntryId,
    });
    const message = updateError?.message || 'Queue entry was not updated';
    const status = message.includes('not found')
      ? 404
      : message.includes('No changes')
        ? 409
        : message.includes('invalid') ||
            message.includes('required') ||
            updateError?.code === '23505'
          ? 400
          : 500;
    const publicMessage = updateError?.code === '23505'
      ? 'Phone number already in use.'
      : message;
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(JSON.stringify({ error: publicMessage }), {
      status,
      headers,
    });
  }

  const headers = new Headers();
  withCorsHeaders(headers, origin, path);
  return new Response(JSON.stringify({ success: true, entry: updatedRows[0] }), {
    status: 200,
    headers,
  });
});
