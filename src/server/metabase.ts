import 'server-only';

import { createHmac } from 'crypto';

type MetabaseEmbedOptions = {
  siteUrl: string;
  secret: string;
  dashboardId: number;
  ttlSeconds: number;
  params?: Record<string, unknown>;
};

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const token = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  const encodedSignature = signature
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${token}.${encodedSignature}`;
}

export function buildMetabaseEmbedUrl(options: MetabaseEmbedOptions): string {
  const siteUrl = options.siteUrl.replace(/\/$/, '');
  const payload = {
    resource: { dashboard: options.dashboardId },
    params: options.params ?? {},
    exp: Math.floor(Date.now() / 1000) + options.ttlSeconds,
  };
  const jwt = signJwt(payload, options.secret);
  return `${siteUrl}/embed/dashboard/${jwt}#bordered=true&titled=true`;
}
