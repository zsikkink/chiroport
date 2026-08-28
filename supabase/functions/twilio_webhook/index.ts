import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { verifyTwilioSignature } from '../_shared/twilio.ts';
import { normalizePhoneToE164 } from '../_shared/phone.ts';
import { createServiceRoleClient } from '../_shared/supabaseClient.ts';
import { sendOutboxForEntry } from '../_shared/outbox.ts';
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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const path = new URL(req.url).pathname;
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const service = createServiceRoleClient();
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(
    service,
    [
      {
        bucket: `ip:${ip}`,
        limit: getRateLimitConfig('RATE_LIMIT_TWILIO_IP_PER_MIN', 120),
        windowSeconds: 60,
      },
    ],
    { endpoint: 'twilio_webhook', logContext: { ip }, failOpen: false }
  );

  if (!rateLimit.allowed) {
    return buildRateLimitResponse({
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      origin,
      path,
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

  const { data: inboundRows, error: inboundError } = await service.rpc(
    'record_sms_inbound',
    {
      p_from_phone: fromE164 ?? fromRaw,
      p_to_phone: toRaw,
      p_body: bodyRaw,
      p_provider_message_id: messageSid,
      p_raw: formPayload,
    }
  );
  if (inboundError) {
    console.error('twilio_webhook sms_inbound command failed', inboundError);
    return new Response(null, { status: 500 });
  }
  const associatedEntryId = inboundRows?.[0]?.out_queue_entry_id ?? null;

  const normalizedBody = bodyRaw.trim().toLowerCase();
  if (normalizedBody === 'stop') {
    if (fromE164) {
      const { error } = await service.from('sms_opt_outs').upsert(
        {
          phone_e164: fromE164,
          opted_out_at: new Date().toISOString(),
          source: 'twilio_webhook',
        },
        { onConflict: 'phone_e164' }
      );
      if (error) {
        console.error('twilio_webhook opt-out insert failed', error);
      }
    }
    return new Response(null, { status: 204 });
  }

  if (normalizedBody === 'start') {
    if (fromE164) {
      const { error } = await service
        .from('sms_opt_outs')
        .delete()
        .eq('phone_e164', fromE164);
      if (error) {
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

  if (!associatedEntryId) {
    return new Response(null, { status: 204 });
  }

  const { data: cancelRows, error: cancelError } = await service.rpc(
    'customer_cancel_queue_entry',
    {
      p_entry_id: associatedEntryId,
      p_source: 'twilio_webhook',
      p_enqueue_ack: true,
    }
  );

  if (cancelError || !cancelRows?.length) {
    console.error('twilio_webhook cancel command failed', cancelError);
    return new Response(null, { status: 500 });
  }

  try {
    await sendOutboxForEntry(service, associatedEntryId, 'cancel_ack');
  } catch (error) {
    // Delivery is best effort here; the committed outbox row remains retryable.
    console.error('twilio_webhook cancel ack send failed', error);
  }

  return new Response(null, { status: 204 });
});
