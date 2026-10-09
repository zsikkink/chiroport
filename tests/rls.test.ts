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

  itIf('employee reads succeed while direct operational writes fail', async () => {
    if (!env?.serviceKey) return;
    const service = createServiceClient(env);
    const employee = createAnonClient(env);
    const email = `rls-write-boundary-${Date.now()}@example.com`;
    const password = 'TestPass123!';
    const phone = `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const { data: location } = await service
      .from('locations')
      .select('airport_code,code')
      .eq('is_open', true)
      .limit(1)
      .single();
    const { data: joined, error: joinError } = await service.rpc(
      'join_queue_with_offering',
      {
        p_airport_code: location!.airport_code,
        p_location_code: location!.code,
        p_full_name: 'Write Boundary Test',
        p_phone_e164: phone,
        p_email: 'boundary@example.com',
        p_offering_code: 'chiropractic',
      }
    );
    expect(joinError).toBeNull();
    const entryId = joined?.[0]?.out_queue_entry_id;
    const { data: entry } = await service
      .from('queue_entries')
      .select('queue_id,customer_id')
      .eq('id', entryId!)
      .single();

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
      const { error: signInError } = await employee.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeNull();

      const read = await employee
        .from('queue_entries')
        .select('id,status')
        .eq('id', entryId!)
        .single();
      expect(read.error).toBeNull();

      const attempts = await Promise.all([
        employee.from('queue_entries').update({ status: 'completed' }).eq('id', entryId!),
        employee.from('queue_entries').delete().eq('id', entryId!),
        employee.from('queue_events').insert({
          queue_entry_id: entryId!,
          event_type: 'direct_employee_bypass',
          payload: {},
        }),
        employee.from('queues').update({ is_open: false }).eq('id', entry!.queue_id),
        employee
          .from('customers')
          .update({ full_name: 'Direct Bypass' })
          .eq('id', entry!.customer_id),
      ]);
      for (const attempt of attempts) expect(attempt.error).toBeTruthy();

      const command = await service.rpc('staff_queue_entry_action', {
        p_entry_id: entryId!,
        p_action: 'serving',
        p_target_location_id: null,
        p_actor_user_id: userId!,
      });
      expect(command.error).toBeNull();
      const { data: after } = await service
        .from('queue_entries')
        .select('status')
        .eq('id', entryId!)
        .single();
      expect(after?.status).toBe('serving');
    } finally {
      if (entryId) {
        await service.from('sms_outbox').delete().eq('queue_entry_id', entryId);
        await service.from('queue_entries').delete().eq('id', entryId);
      }
      if (entry?.customer_id) {
        await service.from('customers').delete().eq('id', entry.customer_id);
      }
      if (userId) {
        await service.from('employee_profiles').delete().eq('user_id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  });
});
