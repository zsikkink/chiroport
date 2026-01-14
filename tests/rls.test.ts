/** @jest-environment node */
import { createAnonClient, createServiceClient, getTestEnv } from './helpers/supabase';

const env = getTestEnv();
const itIf = env ? test : test.skip;

describe('RLS access checks', () => {
  itIf('anon can read locations but not customers/queue_entries', async () => {
    const anon = createAnonClient(env!);

    const locations = await anon.from('locations').select('id').limit(1);
    expect(locations.error).toBeNull();

    const customers = await anon.from('customers').select('id').limit(1);
    expect(customers.error).not.toBeNull();

    const entries = await anon.from('queue_entries').select('id').limit(1);
    expect(entries.error).not.toBeNull();
  });

  itIf('service role can read customers', async () => {
    if (!env?.serviceKey) return;
    const service = createServiceClient(env);
    const customers = await service.from('customers').select('id').limit(1);
    expect(customers.error).toBeNull();
  });
});
