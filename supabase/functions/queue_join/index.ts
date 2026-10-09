import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'npm:zod@3.25.76';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { createServiceRoleClient } from '../_shared/supabaseClient.ts';
import { normalizePhoneToE164 } from '../_shared/phone.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { MESSAGE_TYPES } from '../_shared/messages.ts';
import { errorResponse } from '../_shared/httpError.ts';
import {
  isSettledOutboxResult,
  sendOutboxForEntry,
} from '../_shared/outbox.ts';

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) return first.trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return 'unknown';
}

const joinSchema = z.object({
  airportCode: z.string().min(1),
  locationCode: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  consent: z.boolean(),
  offeringCode: z.string().min(1).optional(),
  // Legacy fields remain optional for a rolling web/Edge deployment.
  customerType: z.enum(['paying', 'priority_pass']).optional(),
  serviceLabel: z.string().min(1).optional(),
  consentVersionId: z.string().uuid().optional(),
  consentKey: z
    .enum([
      'queue_join_consent_bodywork',
      'queue_join_consent_chiropractic',
      'queue_join_consent',
    ])
    .optional(),
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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse('validation_error', 'Invalid JSON body', 400, headers);
  }

  const parsed = joinSchema.safeParse(payload);
  if (!parsed.success) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      'validation_error',
      'Invalid payload',
      400,
      headers,
      parsed.error.flatten()
    );
  }

  if (!parsed.data.consent) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse('validation_error', 'Consent is required', 400, headers);
  }

  const phoneE164 = normalizePhoneToE164(parsed.data.phone);
  if (!phoneE164) {
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse('validation_error', 'Invalid phone number', 400, headers);
  }

  const supabase = createServiceRoleClient();
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(
    supabase,
    [
      {
        bucket: `ip:${ip}`,
        limit: getRateLimitConfig('RATE_LIMIT_QUEUE_JOIN_IP_PER_MIN', 30),
        windowSeconds: 60,
      },
      {
        bucket: `phone:${phoneE164}:hour`,
        limit: getRateLimitConfig('RATE_LIMIT_QUEUE_JOIN_PHONE_PER_HOUR', 5),
        windowSeconds: 60 * 60,
      },
      {
        bucket: `phone:${phoneE164}:day`,
        limit: getRateLimitConfig('RATE_LIMIT_QUEUE_JOIN_PHONE_PER_DAY', 10),
        windowSeconds: 60 * 60 * 24,
      },
    ],
    {
      endpoint: 'queue_join',
      logContext: { ip, phone: phoneE164 },
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

  try {
    let offeringCode = parsed.data.offeringCode?.trim();
    if (!offeringCode) {
      const legacyLabel = parsed.data.serviceLabel?.trim();
      if (!legacyLabel) {
        const headers = new Headers();
        withCorsHeaders(headers, origin, path);
        return errorResponse(
          'validation_error',
          'Service offering is required',
          400,
          headers
        );
      }

      if (legacyLabel === 'Paying') {
        offeringCode = 'chiropractic';
      } else {
        const { data: legacyOffering } = await supabase
          .from('service_offerings')
          .select('code')
          .eq('display_label', legacyLabel)
          .eq('is_active', true)
          .maybeSingle();
        offeringCode = legacyOffering?.code;
      }
    }

    if (!offeringCode) {
      const headers = new Headers();
      withCorsHeaders(headers, origin, path);
      return errorResponse(
        'validation_error',
        'Service offering is invalid',
        400,
        headers
      );
    }

    const { data: joinRows, error: joinError } = await supabase.rpc('join_queue_with_offering', {
      p_airport_code: parsed.data.airportCode,
      p_location_code: parsed.data.locationCode,
      p_full_name: parsed.data.name,
      p_phone_e164: phoneE164,
      p_email: parsed.data.email,
      p_offering_code: offeringCode,
    });

    if (joinError || !joinRows?.length) {
      const headers = new Headers();
      withCorsHeaders(headers, origin, path);
      const expectedDomainError = joinError?.code === 'P0001';
      return errorResponse(
        expectedDomainError ? 'validation_error' : 'dependency_unavailable',
        joinError?.message || 'Failed to join queue',
        expectedDomainError ? 400 : 503,
        headers
      );
    }

    const joinResult = joinRows[0];
    const [{ data: queueData }, { data: entryData }] = await Promise.all([
      supabase
        .from('queues')
        .select('id, location:locations(display_name, timezone)')
        .eq('id', joinResult.out_queue_id)
        .single(),
      supabase
        .from('queue_entries')
        .select('customer_type')
        .eq('id', joinResult.out_queue_entry_id)
        .single(),
    ]);

    const queueLocation = Array.isArray(queueData?.location)
      ? queueData.location[0]
      : queueData?.location;
    const locationDisplayName =
      queueLocation?.display_name ?? 'The Chiroport';
    const customerType = entryData?.customer_type;
    if (customerType !== 'paying' && customerType !== 'priority_pass') {
      throw new Error('Queue entry has an invalid customer type');
    }

    try {
      const delivery = await sendOutboxForEntry(
        supabase,
        joinResult.out_queue_entry_id,
        MESSAGE_TYPES.CONFIRM
      );
      if (!isSettledOutboxResult(delivery)) {
        console.error('queue_join immediate confirmation incomplete', {
          queueEntryId: joinResult.out_queue_entry_id,
          delivery,
        });
      }

      if (
        customerType === 'paying' &&
        Number(joinResult.out_queue_position) === 1
      ) {
        try {
          const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          if (serviceRoleKey && supabaseUrl) {
            await fetch(`${supabaseUrl}/functions/v1/send_sms`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceRoleKey}`,
                apikey: serviceRoleKey,
              },
              body: JSON.stringify({}),
            });
          }
        } catch (error) {
          console.error('queue_join send_sms trigger failed', error);
        }
      }
    } catch (error) {
      console.error('queue_join immediate send failed', error);
    }

    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return new Response(
      JSON.stringify({
        queueEntryId: joinResult.out_queue_entry_id,
        publicToken: joinResult.out_public_token,
        queueId: joinResult.out_queue_id,
        status: joinResult.out_status,
        createdAt: joinResult.out_created_at,
        queuePosition: joinResult.out_queue_position,
        locationDisplayName,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('queue_join failed', error);
    const headers = new Headers();
    withCorsHeaders(headers, origin, path);
    return errorResponse(
      'internal_error',
      error instanceof Error ? error.message : 'Queue join failed',
      500,
      headers
    );
  }
});
