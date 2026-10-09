/** @jest-environment node */
import { createHmac } from 'node:crypto';
import { loadEdge } from './helpers/edge-runtime.cjs';
const secret = 'synthetic-only';
const config = { TWILIO_AUTH_TOKEN: secret, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', SEND_SMS_SECRET: secret };
const rateLimit = { checkRateLimit: async () => ({ allowed: true }), getRateLimitConfig: (_name: string, fallback: number) => fallback };

it.each(['STOP', 'START'])('%s acknowledges only durable preference writes', async action => {
  for (const failed of [true, false]) {
    const service = { rpc: jest.fn(async (name: string) => ({ data: [{ out_queue_entry_id: null, out_sms_inbound_id: 'synthetic-inbound' }], error: name === 'apply_sms_preference' && failed ? { message: 'synthetic failure' } : null })) };
    const { handler } = loadEdge('twilio_webhook/index.ts', { service, env: config, console: { error() {}, warn() {} }, overrides: { '../_shared/rateLimit.ts': rateLimit } });
    const url = 'http://127.0.0.1:54321/functions/v1/twilio_webhook';
    const form: Record<string, string> = { From: '+12025550123', To: '+12025550124', Body: action, MessageSid: 'SM_SYNTHETIC' };
    const signature = createHmac('sha1', secret).update(url + Object.keys(form).sort().map(key => key + form[key]).join('')).digest('base64');
    const response = await handler(new Request(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature }, body: new URLSearchParams(form) }));
    expect(response.status).toBe(failed ? 500 : 204);
    const invalid = await handler(new Request(url, { method: 'POST', headers: { 'x-twilio-signature': 'invalid' }, body: new URLSearchParams(form) }));
    expect(invalid.status).toBe(403);
    expect(service.rpc).toHaveBeenCalledTimes(2);
  }
});

it.each([
  [{ authorization: 'Bearer synthetic-service' }, 200],
  [{ authorization: 'bearer synthetic-service' }, 200],
  [{ apikey: 'synthetic-service' }, 200],
  [{ 'x-sms-secret': secret }, 200],
  [{ 'x-internal-secret': secret }, 200],
  [{}, 401],
  [{ authorization: 'Bearer ordinary-user' }, 401],
  [{ authorization: 'synthetic-service' }, 401],
  [{ authorization: 'Bearer synthetic-service extra' }, 401],
  [{ apikey: 'wrong', 'x-sms-secret': 'wrong' }, 401],
] as const)('worker validates credentials before claiming work (%j)', async (headers, status) => {
  const rpc = jest.fn(async () => ({ data: [], error: null }));
  const { handler } = loadEdge('send_sms/index.ts', { service: { rpc }, env: config, overrides: { '../_shared/rateLimit.ts': rateLimit } });
  expect((await handler(new Request('http://127.0.0.1/functions/v1/send_sms', { method: 'POST', headers }))).status).toBe(status);
  expect(rpc).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
});


it.each(['0', '101', '-1', '1.5', 'invalid'])('worker rejects an invalid batch limit %s before claiming', async limit => {
  const rpc = jest.fn();
  const { handler } = loadEdge('send_sms/index.ts', { service: { rpc }, env: config, overrides: { '../_shared/rateLimit.ts': rateLimit } });
  expect((await handler(new Request(`http://127.0.0.1/functions/v1/send_sms?limit=${limit}`, { method: 'POST', headers: { 'x-sms-secret': secret } }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

it('worker waits for provider completion before claiming the next row', async () => {
  let finishSend!: () => void;
  const send = jest.fn(() => new Promise(resolve => { finishSend = () => resolve({ status: 'sent' }); }));
  const rpc = jest.fn().mockResolvedValueOnce({ data: [{ id: 'first' }], error: null }).mockResolvedValueOnce({ data: [], error: null });
  const { handler } = loadEdge('send_sms/index.ts', { service: { rpc }, env: config, overrides: { '../_shared/rateLimit.ts': rateLimit, '../_shared/outbox.ts': { sendClaimedMessage: send } } });
  const request = handler(new Request('http://127.0.0.1/functions/v1/send_sms?limit=2', { method: 'POST', headers: { 'x-sms-secret': secret } }));
  for (let index = 0; index < 10 && !send.mock.calls.length; index++) await Promise.resolve();
  expect(send).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('claim_sms_outbox', { p_limit: 1, p_lock_minutes: 5 });
  finishSend();
  expect((await request).status).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(2);
});
