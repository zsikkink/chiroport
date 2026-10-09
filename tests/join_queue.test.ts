/** @jest-environment node */
import { createServiceClient, getTestEnv, randomPhone } from './helpers/supabase';

const env = getTestEnv();
const itIf = env && env.serviceKey ? test : test.skip;

describe('join_queue_with_offering domain command', () => {
  itIf('creates a queue entry and derives canonical offering fields', async () => {
    const service = createServiceClient(env!);

    const { data: location } = await service
      .from('locations')
      .select('airport_code, code')
      .eq('is_open', true)
      .limit(1)
      .maybeSingle();

    expect(location).toBeTruthy();

    const phone = randomPhone();

    const { data, error } = await service.rpc('join_queue_with_offering', {
      p_airport_code: location!.airport_code,
      p_location_code: location!.code,
      p_full_name: 'Test User',
      p_phone_e164: phone,
      p_email: 'test@example.com',
      p_offering_code: 'chiropractic',
    });

    expect(error).toBeNull();
    expect(data?.[0]?.out_queue_entry_id).toBeTruthy();
    expect(data?.[0]?.out_public_token).toBeTruthy();

    const entryId = data?.[0]?.out_queue_entry_id as string | undefined;
    if (entryId) {
      const { data: entry } = await service
        .from('queue_entries')
        .select('offering_code,customer_type,service_label')
        .eq('id', entryId)
        .single();
      expect(entry).toEqual({
        offering_code: 'chiropractic',
        customer_type: 'paying',
        service_label: 'Chiropractor',
      });
      await service.from('sms_outbox').delete().eq('queue_entry_id', entryId);
      await service.from('queue_entries').delete().eq('id', entryId);
    }
    await service.from('customers').delete().eq('phone_e164', phone);
  });
});
