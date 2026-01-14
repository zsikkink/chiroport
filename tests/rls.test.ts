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

  itIf('authenticated employee can read queue_entries', async () => {
    if (!env?.serviceKey) return;
    const service = createServiceClient(env);
    const anon = createAnonClient(env);
    const email = `rls-employee-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    const { data: userData, error: userError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    expect(userError).toBeNull();
    const userId = userData?.user?.id;
    expect(userId).toBeTruthy();

    try {
      const { error: profileError } = await service.from('employee_profiles').insert({
        user_id: userId,
        role: 'employee',
        is_open: true,
      });
      expect(profileError).toBeNull();

      const { error: signInError } = await anon.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeNull();

      const entries = await anon.from('queue_entries').select('id').limit(1);
      expect(entries.error).toBeNull();
    } finally {
      if (userId) {
        await service.from('employee_profiles').delete().eq('user_id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  });
});
