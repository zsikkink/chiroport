import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { verifyTwilioSignature } from '../_shared/twilio.ts';
import { normalizePhoneToE164 } from '../_shared/phone.ts';
import { MESSAGE_TYPES, buildCancelAck } from '../_shared/messages.ts';
import { requireEnv } from '../_shared/env.ts';
import { createServiceRoleClient } from '../_shared/supabaseClient.ts';
import { enqueueAndSendOutboxMessage } from '../_shared/outbox.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';

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

function buildSignatureUrls(req: Request) {
  const url = new URL(req.url);
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedPort = req.headers.get('x-forwarded-port');
  const forwardedPath = req.headers.get('x-forwarded-uri');
  const hostHeader = req.headers.get('host');
  const basePath = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`;
  const withFunctionsPath = basePath.startsWith('/functions/v1/')
    ? basePath
    : `/functions/v1${basePath}`;
  const candidates = new Set<string>();

  const addCandidate = (value: string) => {
    if (!value) return;
    candidates.add(value);
    if (value.endsWith('/')) {
      candidates.add(value.slice(0, -1));
    } else {
      candidates.add(`${value}/`);
    }
  };

  addCandidate(url.toString());
  addCandidate(`${url.origin}${url.pathname}`);

  if (forwardedProto && forwardedHost) {
    const host =
      forwardedPort && forwardedPort !== '80' && forwardedPort !== '443'
        ? `${forwardedHost}:${forwardedPort}`
        : forwardedHost;
    const path = forwardedPath ?? `${url.pathname}${url.search}`;
    addCandidate(`${forwardedProto}://${host}${path}`);
    addCandidate(`${forwardedProto}://${host}${withFunctionsPath}${url.search}`);
  }

  if (hostHeader) {
    const proto = forwardedProto ?? url.protocol.replace(':', '') ?? 'https';
    addCandidate(`${proto}://${hostHeader}${url.pathname}${url.search}`);
    addCandidate(`${proto}://${hostHeader}${withFunctionsPath}${url.search}`);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (supabaseUrl) {
    const base = supabaseUrl.replace(/\/$/, '');
    addCandidate(`${base}${withFunctionsPath}${url.search}`);
    addCandidate(`${base}${withFunctionsPath}`);
  }

  return Array.from(candidates);
}

function parseFormPayload(body: string) {
  const params = new URLSearchParams(body);
  const payload: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    payload[key] = value;
  }
  return payload;
}

function getRestConfig() {
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return { supabaseUrl, serviceRoleKey };
}

async function restRequest<T>(
  path: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
) {
  const { supabaseUrl, serviceRoleKey } = getRestConfig();
  const headers = new Headers({
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json',
    ...options.headers,
  });

  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostgREST ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(
    createServiceRoleClient(),
    [
      {
        bucket: `ip:${ip}`,
        limit: getRateLimitConfig('RATE_LIMIT_TWILIO_IP_PER_MIN', 120),
        windowSeconds: 60,
      },
    ],
    { endpoint: 'twilio_webhook', logContext: { ip } }
  );

  if (!rateLimit.allowed) {
    return buildRateLimitResponse({
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  const contentType = req.headers.get('content-type') ?? '';
  const rawBody = await req.text();
  let formPayload: Record<string, string> = {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    formPayload = parseFormPayload(rawBody);
  } else {
    formPayload = parseFormPayload(rawBody);
  }

  const signature = req.headers.get('x-twilio-signature');
  const urlCandidates = buildSignatureUrls(req);
  const isValid = await verifyTwilioSignature({
    urls: urlCandidates,
    formData: formPayload,
    signature,
    rawBody,
  });

  if (!isValid) {
    console.warn('twilio_webhook invalid signature', {
      urls: urlCandidates,
      hasSignature: Boolean(signature),
      forwardedHost: req.headers.get('x-forwarded-host'),
      forwardedProto: req.headers.get('x-forwarded-proto'),
    });
    return new Response('Invalid signature', { status: 403 });
  }

  const fromRaw = formPayload.From ?? '';
  const toRaw = formPayload.To ?? '';
  const bodyRaw = formPayload.Body ?? '';
  const messageSid = formPayload.MessageSid ?? null;
  const fromE164 = normalizePhoneToE164(fromRaw);

  try {
    await restRequest('/sms_inbound?on_conflict=provider_message_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: {
        from_phone: fromE164 ?? fromRaw,
        to_phone: toRaw,
        body: bodyRaw,
        provider_message_id: messageSid,
        raw: formPayload,
      },
    });
  } catch (error) {
    console.error('twilio_webhook sms_inbound insert failed', error);
  }

  const normalizedBody = bodyRaw.trim().toLowerCase();
  if (normalizedBody === 'stop') {
    if (fromE164) {
      try {
        await restRequest('/sms_opt_outs?on_conflict=phone_e164', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: {
            phone_e164: fromE164,
            opted_out_at: new Date().toISOString(),
            source: 'twilio_webhook',
          },
        });
      } catch (error) {
        console.error('twilio_webhook opt-out insert failed', error);
      }
    }
    return new Response(null, { status: 204 });
  }

  if (normalizedBody === 'start') {
    if (fromE164) {
      try {
        await restRequest(`/sms_opt_outs?phone_e164=eq.${encodeURIComponent(fromE164)}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('twilio_webhook opt-out removal failed', error);
      }
    }
    return new Response(null, { status: 204 });
  }

  if (normalizedBody !== 'cancel') {
    return new Response(null, { status: 204 });
  }

  if (!fromE164) {
    return new Response(null, { status: 204 });
  }

  let entry:
    | {
        id: string;
        status: string;
        queue_id: string;
        customer_id: string;
        created_at: string;
      }
    | undefined;
  try {
    const entries = await restRequest<
      Array<{
        id: string;
        status: string;
        queue_id: string;
        customer_id: string;
        created_at: string;
        customers?: { full_name?: string | null } | null;
      }>
    >(
      `/queue_entries?select=id,status,queue_id,customer_id,created_at,customers!inner(phone_e164,full_name)&status=in.(waiting,serving)&customers.phone_e164=eq.${encodeURIComponent(
        fromE164
      )}&order=created_at.desc&limit=1`,
      { method: 'GET' }
    );
    entry = entries?.[0];
  } catch (error) {
    console.error('twilio_webhook queue lookup failed', error);
  }

  if (!entry) {
    return new Response(null, { status: 204 });
  }

  let cancelled = false;
  try {
    const updated = await restRequest<
      Array<{ id: string; status: string; cancelled_at: string | null }>
    >(`/queue_entries?id=eq.${entry.id}&status=in.(waiting,serving)`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: { status: 'cancelled', cancelled_at: new Date().toISOString() },
    });
    cancelled = Boolean(updated?.length);
  } catch (error) {
    console.error('twilio_webhook cancel update failed', error);
  }

  if (cancelled) {
    try {
      await restRequest('/queue_events', {
        method: 'POST',
        body: {
          queue_entry_id: entry.id,
          actor_user_id: null,
          event_type: 'cancelled_by_customer',
          payload: { source: 'twilio_webhook' },
        },
      });
    } catch (error) {
      console.error('twilio_webhook queue_event insert failed', error);
    }

    const idempotencyKey = `cancel_ack:${entry.id}`;
    try {
      const service = createServiceRoleClient();
      await enqueueAndSendOutboxMessage(service, {
        queue_entry_id: entry.id,
        message_type: MESSAGE_TYPES.CANCEL_ACK,
        to_phone: fromE164,
        body: buildCancelAck(),
        status: 'queued',
        idempotency_key: idempotencyKey,
      });
    } catch (error) {
      console.error('twilio_webhook cancel ack send failed', error);
    }
  }

  return new Response(null, { status: 204 });
});
