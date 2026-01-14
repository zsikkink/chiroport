import { test, expect } from '@playwright/test';
import { createAnonClient, createServiceClient, getTestEnv, randomPhone } from '../helpers/supabase';

test.describe('queue smoke', () => {
  test('join -> outbox -> claim -> cancel/complete', async () => {
    const env = getTestEnv();
    test.skip(!env || !env.serviceKey, 'Missing Supabase env for E2E smoke');
    const service = createServiceClient(env!);
    const anon = createAnonClient(env!);

    const { data: location } = await service
      .from('locations')
      .select('id, airport_code, code')
      .eq('is_open', true)
      .limit(1)
      .maybeSingle();

    const { data: consent } = await service
      .from('consent_versions')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    expect(location).toBeTruthy();
    expect(consent).toBeTruthy();

    const phone = randomPhone();
    const { data: joinRows, error: joinError } = await anon.rpc('join_queue', {
      p_airport_code: location!.airport_code,
      p_location_code: location!.code,
      p_full_name: 'Smoke Test',
      p_phone_e164: phone,
      p_email: 'smoke@example.com',
      p_customer_type: 'priority_pass',
      p_consent_version_id: consent!.id,
      p_service_label: 'Priority Pass',
    });

    expect(joinError).toBeNull();
    const entryId = joinRows?.[0]?.out_queue_entry_id as string;
    const publicToken = joinRows?.[0]?.out_public_token as string;
    expect(entryId).toBeTruthy();
    expect(publicToken).toBeTruthy();

    const { data: outboxRow, error: outboxError } = await service
      .from('sms_outbox')
      .insert({
        queue_entry_id: entryId,
        message_type: 'confirm',
        to_phone: phone,
        body: 'Test confirm',
        status: 'queued',
        idempotency_key: `confirm:${entryId}`,
      })
      .select('id')
      .maybeSingle();

    expect(outboxError).toBeNull();
    expect(outboxRow?.id).toBeTruthy();

    const { data: claimed, error: claimError } = await service.rpc('claim_sms_outbox', {
      p_limit: 1,
      p_lock_minutes: 5,
      p_message_id: outboxRow!.id,
    });

    expect(claimError).toBeNull();
    expect(claimed?.[0]?.id).toBe(outboxRow!.id);

    const { data: cancelRows, error: cancelError } = await anon.rpc('cancel_visit', {
      p_public_token: publicToken,
    });

    expect(cancelError).toBeNull();
    expect(cancelRows?.[0]?.out_status).toBe('cancelled');

    const phone2 = randomPhone();
    const { data: joinRows2, error: joinError2 } = await anon.rpc('join_queue', {
      p_airport_code: location!.airport_code,
      p_location_code: location!.code,
      p_full_name: 'Serve Test',
      p_phone_e164: phone2,
      p_email: 'serve@example.com',
      p_customer_type: 'priority_pass',
      p_consent_version_id: consent!.id,
      p_service_label: 'Priority Pass',
    });

    expect(joinError2).toBeNull();
    const entryId2 = joinRows2?.[0]?.out_queue_entry_id as string;
    expect(entryId2).toBeTruthy();

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
      await service.from('employee_profiles').insert({
        user_id: userId,
        role: 'employee',
        is_open: true,
      });

      const { data: sessionData, error: signInError } = await anon.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeNull();
      const token = sessionData?.session?.access_token;
      expect(token).toBeTruthy();

      const baseUrl = env!.url.replace(/\/$/, '');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const servingRes = await fetch(`${baseUrl}/functions/v1/queue_entry_action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'serving', queueEntryId: entryId2 }),
      });
      expect(servingRes.ok).toBeTruthy();

      const completeRes = await fetch(`${baseUrl}/functions/v1/queue_entry_action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'complete', queueEntryId: entryId2 }),
      });
      expect(completeRes.ok).toBeTruthy();

      const { data: completedEntry } = await service
        .from('queue_entries')
        .select('status')
        .eq('id', entryId2)
        .maybeSingle();
      expect(completedEntry?.status).toBe('completed');
    } finally {
      if (userId) {
        await service.from('employee_profiles').delete().eq('user_id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }

    await service.from('sms_outbox').delete().eq('queue_entry_id', entryId);
    await service.from('queue_entries').delete().in('id', [entryId, entryId2]);
    await service.from('customers').delete().in('phone_e164', [phone, phone2]);
  });
});
