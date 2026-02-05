import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'npm:zod@3.23.8';
import { withCorsHeaders, buildCorsHeaders } from '../_shared/cors.ts';
import { createServiceRoleClient } from '../_shared/supabaseClient.ts';
import { normalizePhoneToE164 } from '../_shared/phone.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import {
  MESSAGE_TYPES,
  buildPayingConfirmation,
  buildPriorityPassConfirmation,
} from '../_shared/messages.ts';
import { enqueueAndSendOutboxMessage } from '../_shared/outbox.ts';

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
  customerType: z.enum(['paying', 'priority_pass']),
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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers,
    });
  }

  const parsed = joinSchema.safeParse(payload);
  if (!parsed.success) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(
      JSON.stringify({ error: 'Invalid payload', details: parsed.error.flatten() }),
      { status: 400, headers }
    );
  }

  if (!parsed.data.consent) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Consent is required' }), {
      status: 400,
      headers,
    });
  }

  const phoneE164 = normalizePhoneToE164(parsed.data.phone);
  if (!phoneE164) {
    const headers = new Headers();
    withCorsHeaders(headers, origin);
    return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
      status: 400,
      headers,
    });
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
    withCorsHeaders(headers, origin);
    return buildRateLimitResponse({
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      headers,
      origin,
    });
  }

  try {
    let consentVersionId = parsed.data.consentVersionId;
    const serviceLabel =
      parsed.data.serviceLabel?.trim() ||
      (parsed.data.customerType === 'priority_pass' ? 'Priority Pass' : 'Paying');

    if (!consentVersionId) {
      if (!parsed.data.consentKey) {
        const headers = new Headers();
        withCorsHeaders(headers, origin);
        return new Response(JSON.stringify({ error: 'Consent version is required' }), {
          status: 400,
          headers,
        });
      }

      const { data: consentRow, error: consentError } = await supabase
        .from('consent_versions')
        .select('id')
        .eq('key', parsed.data.consentKey)
        .eq('is_active', true)
        .single();

      if (consentError || !consentRow) {
        const headers = new Headers();
        withCorsHeaders(headers, origin);
        return new Response(JSON.stringify({ error: 'Consent version is unavailable' }), {
          status: 400,
          headers,
        });
      }

      consentVersionId = consentRow.id;
    }

    const { data: joinRows, error: joinError } = await supabase.rpc('join_queue', {
      p_airport_code: parsed.data.airportCode,
      p_location_code: parsed.data.locationCode,
      p_full_name: parsed.data.name,
      p_phone_e164: phoneE164,
      p_email: parsed.data.email,
      p_customer_type: parsed.data.customerType,
      p_consent_version_id: consentVersionId,
      p_service_label: serviceLabel,
    });

    if (joinError || !joinRows?.length) {
      const isDuplicate =
        joinError?.code === '23505' ||
        joinError?.message?.includes('uniq_active_entry_per_customer_per_queue') ||
        joinError?.details?.includes('uniq_active_entry_per_customer_per_queue');

      if (isDuplicate) {
        const { data: locationRow } = await supabase
          .from('locations')
          .select('id, display_name')
          .eq('airport_code', parsed.data.airportCode)
          .eq('code', parsed.data.locationCode)
          .eq('is_open', true)
          .maybeSingle();

        const { data: queueRow } = await supabase
          .from('queues')
          .select('id')
          .eq('location_id', locationRow?.id ?? '')
          .eq('code', 'default')
          .eq('is_open', true)
          .maybeSingle();

        const { data: customerRow } = await supabase
          .from('customers')
          .select('id')
          .eq('phone_e164', phoneE164)
          .maybeSingle();

        const { data: existingEntry } = await supabase
          .from('queue_entries')
          .select('id, public_token, status, created_at, queue_id')
          .eq('queue_id', queueRow?.id ?? '')
          .eq('customer_id', customerRow?.id ?? '')
          .in('status', ['waiting', 'serving'])
          .maybeSingle();

        if (existingEntry) {
          const { data: waitingRow } = await supabase
            .from('employee_queue_waiting_view')
            .select('queue_position')
            .eq('queue_entry_id', existingEntry.id)
            .maybeSingle();

          const headers = new Headers();
          withCorsHeaders(headers, origin);
          return new Response(
            JSON.stringify({
              queueEntryId: existingEntry.id,
              publicToken: existingEntry.public_token,
              queueId: existingEntry.queue_id,
              status: existingEntry.status,
              createdAt: existingEntry.created_at,
              queuePosition: waitingRow?.queue_position ?? null,
              locationDisplayName: locationRow?.display_name ?? 'The Chiroport',
              alreadyInQueue: true,
            }),
            { status: 200, headers }
          );
        }
      }

      const headers = new Headers();
      withCorsHeaders(headers, origin);
      return new Response(
        JSON.stringify({
          error: joinError?.message || 'Failed to join queue',
        }),
        { status: 500, headers }
      );
    }

    const joinResult = joinRows[0];
    const { data: queueData } = await supabase
      .from('queues')
      .select('id, location:locations(display_name, timezone)')
      .eq('id', joinResult.out_queue_id)
      .single();

    const locationDisplayName =
      queueData?.location?.display_name ?? 'The Chiroport';

    let payingQueuePosition = joinResult.out_queue_position;
    if (parsed.data.customerType === 'paying') {
      const { data: entryRow } = await supabase
        .from('queue_entries')
        .select('sort_key')
        .eq('id', joinResult.out_queue_entry_id)
        .maybeSingle();
      if (entryRow?.sort_key != null) {
        const { count: aheadCount } = await supabase
          .from('queue_entries')
          .select('id', { count: 'exact', head: true })
          .eq('queue_id', joinResult.out_queue_id)
          .eq('status', 'waiting')
          .eq('customer_type', 'paying')
          .lt('sort_key', entryRow.sort_key);
        if (aheadCount != null) {
          payingQueuePosition = Number(aheadCount) + 1;
        }
      }
    }

    const messageBody =
      parsed.data.customerType === 'paying'
        ? buildPayingConfirmation({
            name: parsed.data.name,
            locationDisplayName,
            queuePosition: payingQueuePosition,
          })
        : buildPriorityPassConfirmation({
            name: parsed.data.name,
            locationDisplayName,
          });

    try {
      await enqueueAndSendOutboxMessage(supabase, {
        queue_entry_id: joinResult.out_queue_entry_id,
        message_type: MESSAGE_TYPES.CONFIRM,
        to_phone: phoneE164,
        body: messageBody,
        status: 'queued',
        idempotency_key: `confirm:${joinResult.out_queue_entry_id}`,
      });

      if (
        parsed.data.customerType === 'paying' &&
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

    await supabase.from('queue_events').insert({
      queue_entry_id: joinResult.out_queue_entry_id,
      actor_user_id: null,
      event_type: 'joined',
      payload: {
        customer_type: parsed.data.customerType,
        source: 'queue_join',
      },
    });

    const headers = new Headers();
    withCorsHeaders(headers, origin);
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
    withCorsHeaders(headers, origin);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Queue join failed',
      }),
      { status: 500, headers }
    );
  }
});
