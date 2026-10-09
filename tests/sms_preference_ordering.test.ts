/** @jest-environment node */
import { createHmac } from 'node:crypto';
import { createServiceClient, getTestEnv, randomPhone } from './helpers/supabase';
import { loadEdge } from './helpers/edge-runtime.cjs';
const env = getTestEnv();
const itLocal = env?.serviceKey ? it : it.skip;

itLocal.each(['START', 'STOP', '\tSTART\n', '\u00a0STOP\ufeff'])('retrying an earlier %s cannot overwrite newer recorded intent', async earlier => {
  const service = createServiceClient(env!);
  const phone = randomPhone(), secret = 'synthetic-preference-signing-only';
  const later = earlier.trim() === 'START' ? 'STOP' : 'START';
  let failPreference = true;
  const adapter = { rpc: (name: string, args: Record<string, unknown>) => name === 'apply_sms_preference' && failPreference ? Promise.resolve({ error: { message: 'Synthetic interrupted preference write' }, data: null }) : service.rpc(name, args) };
  const { handler } = loadEdge('twilio_webhook/index.ts', { service: adapter, env: { TWILIO_AUTH_TOKEN: secret }, console: { error() {}, warn() {} }, overrides: { '../_shared/rateLimit.ts': { checkRateLimit: async () => ({ allowed: true }), getRateLimitConfig: (_name: string, fallback: number) => fallback } } });
  async function callback(body: string, sid: string) {
    const url = 'http://127.0.0.1:54321/functions/v1/twilio_webhook';
    const form: Record<string, string> = { From: phone, To: '+12025550124', Body: body, MessageSid: sid };
    const signature = createHmac('sha1', secret).update(url + Object.keys(form).sort().map(key => key + form[key]).join('')).digest('base64');
    return handler(new Request(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature }, body: new URLSearchParams(form) }));
  }
  try {
    expect((await callback(earlier, `SM_OLD_${phone}`)).status).toBe(500);
    const before = await service.from('sms_inbound').select('id').eq('from_phone', phone);
    expect(before.error).toBeNull(); expect(before.data).toHaveLength(1);
    failPreference = false;
    expect((await callback(later, `SM_NEW_${phone}`)).status).toBe(204);
    expect((await callback(earlier, `SM_OLD_${phone}`)).status).toBe(204);
    expect((await callback(earlier, `SM_OLD_${phone}`)).status).toBe(204);
    const inbound = await service.from('sms_inbound').select('id').eq('from_phone', phone);
    expect(inbound.error).toBeNull(); expect(inbound.data).toHaveLength(2);
    const optedOut = await service.from('sms_opt_outs').select('phone_e164').eq('phone_e164', phone);
    expect(optedOut.error).toBeNull(); expect(optedOut.data).toHaveLength(later === 'STOP' ? 1 : 0);
    // The serialized resolver reconciles latest receipt even when old/new
    // callback applications overlap. This does not infer vendor send order.
    const applications = await Promise.all(inbound.data!.map(row => service.rpc('apply_sms_preference', { p_inbound_id: row.id })));
    applications.forEach(result => expect(result.error).toBeNull());
    expect((await service.from('sms_opt_outs').select('phone_e164').eq('phone_e164', phone)).data).toHaveLength(later === 'STOP' ? 1 : 0);
    // Conservative tie rule: STOP wins the same persisted timestamp, even
    // when START's application runs last. IDs do not encode vendor send order.
    expect((await service.from('sms_inbound').update({ received_at: '2026-01-01T00:00:00Z' }).eq('from_phone', phone)).error).toBeNull();
    for (const row of inbound.data!) expect((await service.rpc('apply_sms_preference', { p_inbound_id: row.id })).error).toBeNull();
    expect((await service.from('sms_opt_outs').select('phone_e164').eq('phone_e164', phone)).data).toHaveLength(1);
    expect((await callback('STOP', '')).status).toBe(400);
  } finally {
    await service.from('sms_opt_outs').delete().eq('phone_e164', phone);
    await service.from('sms_inbound').delete().eq('from_phone', phone);
  }
});
