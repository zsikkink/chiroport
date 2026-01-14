/** @jest-environment node */
import { createServiceClient, getTestEnv, randomPhone } from './helpers/supabase';

const env = getTestEnv();
const itIf = env && env.serviceKey ? test : test.skip;

describe('sms_outbox claim guard', () => {
  itIf('does not claim next message until confirm is sent', async () => {
    const service = createServiceClient(env!);

    const { data: location } = await service
      .from('locations')
      .select('airport_code, code')
      .eq('is_open', true)
      .limit(1)
      .maybeSingle();

    const { data: consent } = await service
      .from('consent_versions')
      .select('id')
      .eq('key', 'queue_join_consent_bodywork')
      .eq('is_active', true)
      .maybeSingle();

    expect(location).toBeTruthy();
    expect(consent).toBeTruthy();

    const phone = randomPhone();

    const { data: joinRows } = await service.rpc('join_queue', {
      p_airport_code: location!.airport_code,
      p_location_code: location!.code,
      p_full_name: 'Test User',
      p_phone_e164: phone,
      p_email: 'test@example.com',
      p_customer_type: 'paying',
      p_consent_version_id: consent!.id,
      p_service_label: 'Paying',
    });

    const entryId = joinRows?.[0]?.out_queue_entry_id as string | undefined;
    expect(entryId).toBeTruthy();

    const { data: confirmRow } = await service
      .from('sms_outbox')
      .insert({
        queue_entry_id: entryId,
        message_type: 'confirm',
        to_phone: phone,
        body: 'confirm test',
        status: 'queued',
        idempotency_key: `confirm:${entryId}`,
      })
      .select('id')
      .maybeSingle();

    const { data: nextRow } = await service
      .from('sms_outbox')
      .insert({
        queue_entry_id: entryId,
        message_type: 'next',
        to_phone: phone,
        body: 'next test',
        status: 'queued',
        idempotency_key: `next:${entryId}`,
      })
      .select('id')
      .maybeSingle();

    expect(confirmRow?.id).toBeTruthy();
    expect(nextRow?.id).toBeTruthy();

    const { data: claimBlocked } = await service.rpc('claim_sms_outbox', {
      p_limit: 1,
      p_lock_minutes: 5,
      p_message_id: nextRow!.id,
    });

    expect(claimBlocked?.length ?? 0).toBe(0);

    await service
      .from('sms_outbox')
      .update({ status: 'sent' })
      .eq('id', confirmRow!.id);

    const { data: claimAllowed } = await service.rpc('claim_sms_outbox', {
      p_limit: 1,
      p_lock_minutes: 5,
      p_message_id: nextRow!.id,
    });

    expect(claimAllowed?.length ?? 0).toBe(1);

    await service.from('sms_outbox').delete().eq('queue_entry_id', entryId);
    await service.from('queue_entries').delete().eq('id', entryId);
    await service.from('customers').delete().eq('phone_e164', phone);
  });
});
