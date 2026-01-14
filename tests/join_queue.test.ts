/** @jest-environment node */
import { createAnonClient, createServiceClient, getTestEnv, randomPhone } from './helpers/supabase';

const env = getTestEnv();
const itIf = env && env.serviceKey ? test : test.skip;

describe('join_queue RPC', () => {
  itIf('creates a queue entry and returns identifiers', async () => {
    const anon = createAnonClient(env!);
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

    const { data, error } = await anon.rpc('join_queue', {
      p_airport_code: location!.airport_code,
      p_location_code: location!.code,
      p_full_name: 'Test User',
      p_phone_e164: phone,
      p_email: 'test@example.com',
      p_customer_type: 'paying',
      p_consent_version_id: consent!.id,
      p_service_label: 'Paying',
    });

    expect(error).toBeNull();
    expect(data?.[0]?.out_queue_entry_id).toBeTruthy();
    expect(data?.[0]?.out_public_token).toBeTruthy();

    const entryId = data?.[0]?.out_queue_entry_id as string | undefined;
    if (entryId) {
      await service.from('queue_entries').delete().eq('id', entryId);
    }
    await service.from('customers').delete().eq('phone_e164', phone);
  });
});
