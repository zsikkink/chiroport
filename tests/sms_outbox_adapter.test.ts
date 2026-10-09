/** @jest-environment node */
import { execFileSync } from 'node:child_process';
import { monitorQuery } from '../scripts/check-database-storage.cjs';
import { createServiceClient, getTestEnv, randomPhone } from './helpers/supabase';
import { loadEdge } from './helpers/edge-runtime.cjs';
const env = getTestEnv();
const itLocal = env?.serviceKey ? it : it.skip;

describe('real outbox adapter / claim ownership', () => {
  itLocal('replaying a sent or terminal row reports its actual outcome and performs no provider I/O', async () => {
    const service = createServiceClient(env!);
    const location = await service.from('locations').select('airport_code,code').eq('is_open', true).limit(1).single();
    const joined = await service.rpc('join_queue_with_offering', { p_airport_code: location.data!.airport_code, p_location_code: location.data!.code, p_full_name: 'Synthetic Replay', p_phone_e164: randomPhone(), p_email: 'replay@example.invalid', p_offering_code: 'chiropractic' });
    expect(joined.error).toBeNull();
    const entryId = joined.data![0].out_queue_entry_id;
    const entry = await service.from('queue_entries').select('customer_id').eq('id', entryId).single();
    const { sendOutboxForEntry } = loadEdge('_shared/outbox.ts');
    const sendSms = jest.fn(async () => ({ response: { ok: true }, payload: { sid: 'SM_SYNTHETIC_REPLAY' } }));
    const dependencies = { sendSms, checkLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }), getLimitConfig: (_name: string, fallback: number) => fallback, getLocationId: async () => null };
    try {
      expect((await sendOutboxForEntry(service, entryId, 'confirm', dependencies)).status).toBe('sent');
      expect(await sendOutboxForEntry(service, entryId, 'confirm', dependencies)).toMatchObject({ status: 'sent', alreadySent: true, providerMessageId: 'SM_SYNTHETIC_REPLAY' });
      expect(sendSms).toHaveBeenCalledTimes(1);
      const dbUrl = new URL(process.env.SUPABASE_DB_URL!);
      if (!['localhost', '127.0.0.1', '[::1]'].includes(dbUrl.hostname)) throw new Error('Local monitor regression requires loopback');
      const monitor = () => JSON.parse(execFileSync('psql', [dbUrl.toString(), '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', monitorQuery({ maxPendingMinutes: 10, maxSendingMinutes: 6, maxDeadMessages: 0, maxNewAnomalies: 0, anomaliesSince: '2026-09-01T00:00:00Z' })], { encoding: 'utf8' })).workflow.dead_count;
      const initialDead = monitor();
      for (const reason of ['opted_out', 'superseded_queue_state', 'superseded_queue_move', 'synthetic terminal failure', null]) {
        expect((await service.from('sms_outbox').update({ status: 'dead', last_error: reason }).eq('queue_entry_id', entryId).eq('message_type', 'confirm')).error).toBeNull();
        expect((await sendOutboxForEntry(service, entryId, 'confirm', dependencies)).status).toBe(reason === 'opted_out' ? 'opted_out' : 'permanent_failure');
        expect(monitor()).toBe(initialDead + (reason === null || reason === 'synthetic terminal failure' ? 1 : 0));
      }
      expect(sendSms).toHaveBeenCalledTimes(1);
    } finally {
      await service.from('queue_entries').delete().eq('id', entryId);
      await service.from('customers').delete().eq('id', entry.data!.customer_id);
    }
  });

  itLocal.each(['next', 'serving', 'cancel_ack', 'confirm'])('checks delayed %s eligibility while preserving confirmation-first recovery', async messageType => {
    const service = createServiceClient(env!);
    const location = await service.from('locations').select('airport_code,code').eq('is_open', true).limit(1).single();
    const joined = await service.rpc('join_queue_with_offering', { p_airport_code: location.data!.airport_code, p_location_code: location.data!.code, p_full_name: 'Synthetic Stale SMS', p_phone_e164: randomPhone(), p_email: 'stale@example.invalid', p_offering_code: 'chiropractic' });
    expect(joined.error).toBeNull();
    const entryId = joined.data![0].out_queue_entry_id;
    const entry = await service.from('queue_entries').select('customer_id').eq('id', entryId).single();
    const { sendOutboxForEntry } = loadEdge('_shared/outbox.ts');
    const sendSms = jest.fn(async () => ({ response: { ok: true }, payload: { sid: 'SM_SYNTHETIC_STATE' } }));
    try {
      if (messageType !== 'confirm') expect((await sendOutboxForEntry(service, entryId, 'confirm', { sendSms, checkLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }), getLocationId: async () => null })).status).toBe('sent');
      sendSms.mockClear();
      if (messageType === 'serving') expect((await service.rpc('staff_queue_entry_action', { p_entry_id: entryId, p_action: 'serving', p_actor_user_id: null })).error).toBeNull();
      if (messageType === 'cancel_ack') {
        expect((await service.rpc('customer_cancel_queue_entry', { p_entry_id: entryId, p_source: 'synthetic', p_enqueue_ack: true })).error).toBeNull();
        expect((await service.rpc('staff_queue_entry_action', { p_entry_id: entryId, p_action: 'return', p_actor_user_id: null })).error).toBeNull();
      } else expect((await service.rpc('staff_queue_entry_action', { p_entry_id: entryId, p_action: 'complete', p_actor_user_id: null })).error).toBeNull();
      if (messageType === 'confirm') {
        expect((await service.rpc('staff_queue_entry_action', { p_entry_id: entryId, p_action: 'return', p_actor_user_id: null })).error).toBeNull();
        expect((await service.rpc('customer_cancel_queue_entry', { p_entry_id: entryId, p_source: 'synthetic', p_enqueue_ack: true })).error).toBeNull();
      }
      const result = await sendOutboxForEntry(service, entryId, messageType, { sendSms, checkLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }), getLocationId: async () => null });
      if (messageType === 'confirm') {
        expect(result.status).toBe('sent');
        expect((await sendOutboxForEntry(service, entryId, 'cancel_ack', { sendSms, checkLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }), getLocationId: async () => null })).status).toBe('sent');
        expect(sendSms).toHaveBeenCalledTimes(2);
      } else {
        expect(result).toMatchObject({ status: 'permanent_failure', code: 'superseded_queue_state' });
        expect(sendSms).not.toHaveBeenCalled();
      }
    } finally {
      await service.from('queue_entries').delete().eq('id', entryId);
      await service.from('customers').delete().eq('id', entry.data!.customer_id);
    }
  });

  itLocal.each(['normal', 'near-expiry', 'expired', 'deleted-during-provider', 'reclaimed-during-provider', 'already-reclaimed'])('%s', async mode => {
    const service = createServiceClient(env!);
    const { data: location } = await service.from('locations').select('airport_code,code').eq('is_open', true).limit(1).single();
    const { data: joined, error: joinError } = await service.rpc('join_queue_with_offering', { p_airport_code: location!.airport_code, p_location_code: location!.code, p_full_name: 'Synthetic Adapter', p_phone_e164: randomPhone(), p_email: 'adapter@example.invalid', p_offering_code: 'chiropractic' });
    expect(joinError).toBeNull();
    const entryId = joined![0].out_queue_entry_id;
    const { data: entry } = await service.from('queue_entries').select('customer_id').eq('id', entryId).single();
    const { data: row } = await service.from('sms_outbox').select('id').eq('queue_entry_id', entryId).eq('message_type', 'confirm').single();
    const { sendClaimedMessage, claimOutboxMessage } = loadEdge('_shared/outbox.ts');
    const message = await claimOutboxMessage(service, row!.id);
    if (mode === 'near-expiry' || mode === 'expired') expect((await service.from('sms_outbox').update({ locked_at: new Date(Date.now() - (mode === 'expired' ? 360_000 : 270_000)).toISOString() }).eq('id', row!.id)).error).toBeNull();
    let secondClaim: { attempt_count: number } | undefined;
    async function reclaim() {
      expect((await service.from('sms_outbox').update({ locked_at: '2000-01-01T00:00:00Z' }).eq('id', row!.id)).error).toBeNull();
      secondClaim = await claimOutboxMessage(service, row!.id);
      expect(secondClaim!.attempt_count).toBe(message.attempt_count + 1);
    }
    const sendSms = jest.fn(async () => {
      if (mode === 'near-expiry') {
        const { data: renewed } = await service.from('sms_outbox').select('locked_at').eq('id', row!.id).single();
        expect(Date.now() - Date.parse(renewed!.locked_at)).toBeLessThan(2000);
      }
      // Provider completion is deliberately held until the real DB write or
      // competing claim finishes; there is no wall-clock timing assumption.
      if (mode === 'deleted-during-provider') expect((await service.from('sms_outbox').delete().eq('id', row!.id)).error).toBeNull();
      if (mode === 'reclaimed-during-provider') await reclaim();
      return { response: { ok: true }, payload: { sid: 'SM_SYNTHETIC_ACCEPTED' } };
    });
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      if (mode === 'already-reclaimed') await reclaim();
      const result = await sendClaimedMessage(service, message, { sendSms, checkLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }), getLimitConfig: (_name: string, fallback: number) => fallback, getLocationId: async () => null });
      if (mode === 'normal' || mode === 'near-expiry') {
        expect(result).toMatchObject({ status: 'sent', providerMessageId: 'SM_SYNTHETIC_ACCEPTED' });
        expect((await service.from('sms_outbox').select('status,provider_message_id').eq('id', row!.id).single()).data).toMatchObject({ status: 'sent', provider_message_id: 'SM_SYNTHETIC_ACCEPTED' });
      } else if (mode === 'already-reclaimed' || mode === 'expired') {
        expect(sendSms).not.toHaveBeenCalled();
        expect(result.status).toBe('retryable_failure');
      } else {
        expect(sendSms).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ status: 'retryable_failure', code: 'sent_persistence_failed', providerAccepted: true });
      }
      if (secondClaim) {
        expect((await service.from('sms_outbox').select('status,attempt_count,provider_message_id').eq('id', row!.id).single()).data).toMatchObject({ status: 'sending', attempt_count: secondClaim.attempt_count, provider_message_id: null });
      }
    } finally {
      logger.mockRestore();
      await service.from('queue_entries').delete().eq('id', entryId);
      await service.from('customers').delete().eq('id', entry!.customer_id);
    }
  });
});
