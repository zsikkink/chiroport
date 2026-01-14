import { requireEnv } from './env.ts';

function base64Encode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function hmacSha1Base64(secret: string, message: string) {
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return base64Encode(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyTwilioSignature(params: {
  urls: string[];
  formData: Record<string, string>;
  signature: string | null;
  rawBody?: string;
}) {
  if (!params.signature) return false;
  const authSecret = requireEnv('TWILIO_AUTH_TOKEN');

  const sortedKeys = Object.keys(params.formData).sort();
  const suffix = sortedKeys.map((key) => `${key}${params.formData[key]}`).join('');

  for (const url of params.urls) {
    const expected = await hmacSha1Base64(authSecret, url + suffix);
    if (timingSafeEqual(expected, params.signature)) {
      return true;
    }
  }

  if (params.rawBody) {
    for (const url of params.urls) {
      const expected = await hmacSha1Base64(authSecret, url + params.rawBody);
      if (timingSafeEqual(expected, params.signature)) {
        return true;
      }
    }
  }

  return false;
}

export async function sendTwilioSms(params: { to: string; body: string }) {
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const apiKeySid = requireEnv('TWILIO_API_KEY_SID');
  const apiKeySecret = requireEnv('TWILIO_API_KEY_SECRET');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

  if (!messagingServiceSid && !fromNumber) {
    throw new Error('Missing TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set('To', params.to);
  form.set('Body', params.body);
  if (messagingServiceSid) {
    form.set('MessagingServiceSid', messagingServiceSid);
  } else if (fromNumber) {
    form.set('From', fromNumber);
  }

  const auth = btoa(`${apiKeySid}:${apiKeySecret}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}
