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

    expect(location).toBeTruthy();

    const phone = randomPhone();
    const baseUrl = env!.url.replace(/\/$/, '');
    const joinResponse = await fetch(`${baseUrl}/functions/v1/queue_join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airportCode: location!.airport_code,
        locationCode: location!.code,
        name: 'Smoke Test',
        phone,
        email: 'smoke@example.com',
        consent: true,
        offeringCode: 'priority_pass',
      }),
    });
    expect(joinResponse.ok).toBeTruthy();
    const join = (await joinResponse.json()) as {
      queueEntryId?: string;
      publicToken?: string;
    };
    const entryId = join.queueEntryId as string;
    const publicToken = join.publicToken as string;
    expect(entryId).toBeTruthy();
    expect(publicToken).toBeTruthy();

    const { data: outboxRow, error: outboxError } = await service
      .from('sms_outbox')
      .select('id')
      .eq('queue_entry_id', entryId)
      .eq('message_type', 'confirm')
      .maybeSingle();

    expect(outboxError).toBeNull();
    expect(outboxRow?.id).toBeTruthy();

    // The public path attempts immediate delivery. Normalize the durable row
    // so this smoke test can also exercise the worker claim contract without
    // depending on local Twilio configuration.
    const { error: resetOutboxError } = await service
      .from('sms_outbox')
      .update({
        status: 'queued',
        locked_at: null,
        next_attempt_at: new Date().toISOString(),
      })
      .eq('id', outboxRow!.id);
    expect(resetOutboxError).toBeNull();

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
    const joinResponse2 = await fetch(`${baseUrl}/functions/v1/queue_join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airportCode: location!.airport_code,
        locationCode: location!.code,
        name: 'Serve Test',
        phone: phone2,
        email: 'serve@example.com',
        consent: true,
        offeringCode: 'priority_pass',
      }),
    });
    expect(joinResponse2.ok).toBeTruthy();
    const join2 = (await joinResponse2.json()) as { queueEntryId?: string };
    const entryId2 = join2.queueEntryId as string;
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

      const { data: firstServedEntry } = await service
        .from('queue_entries')
        .select('status, served_at')
        .eq('id', entryId2)
        .maybeSingle();
      expect(firstServedEntry?.status).toBe('serving');
      expect(firstServedEntry?.served_at).toBeTruthy();
      const firstServedAt = firstServedEntry?.served_at;

      const returnRes = await fetch(`${baseUrl}/functions/v1/queue_entry_action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'return', queueEntryId: entryId2 }),
      });
      expect(returnRes.ok).toBeTruthy();

      const { data: returnedEntry } = await service
        .from('queue_entries')
        .select('status, served_at')
        .eq('id', entryId2)
        .maybeSingle();
      expect(returnedEntry?.status).toBe('waiting');
      expect(returnedEntry?.served_at).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 25));

      const secondServingRes = await fetch(`${baseUrl}/functions/v1/queue_entry_action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'serving', queueEntryId: entryId2 }),
      });
      expect(secondServingRes.ok).toBeTruthy();

      const { data: secondServedEntry } = await service
        .from('queue_entries')
        .select('status, served_at')
        .eq('id', entryId2)
        .maybeSingle();
      expect(secondServedEntry?.status).toBe('serving');
      expect(secondServedEntry?.served_at).toBeTruthy();
      expect(secondServedEntry?.served_at).not.toBe(firstServedAt);

      const { count: servingMessageCount } = await service
        .from('sms_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('queue_entry_id', entryId2)
        .eq('message_type', 'serving');
      expect(servingMessageCount).toBe(1);

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

  test('public join boundary validates, rate-limits, and cannot be bypassed by RPC', async () => {
    const env = getTestEnv();
    test.skip(!env || !env.serviceKey, 'Missing Supabase env for E2E smoke');
    if (!env || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.url).hostname)) throw new Error('Rate-limit fixtures require loopback Supabase');
    const service = createServiceClient(env!);
    const anon = createAnonClient(env!);
    const baseUrl = env!.url.replace(/\/$/, '');
    const { data: location } = await service
      .from('locations')
      .select('airport_code, code')
      .eq('is_open', true)
      .limit(1)
      .single();

    const invalidPhone = await fetch(`${baseUrl}/functions/v1/queue_join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airportCode: location!.airport_code,
        locationCode: location!.code,
        name: 'Invalid Phone',
        phone: '123',
        email: 'invalid@example.com',
        consent: true,
        offeringCode: 'chiropractic',
      }),
    });
    expect(invalidPhone.status).toBe(400);
    await expect(invalidPhone.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });

    const invalidOffering = await fetch(`${baseUrl}/functions/v1/queue_join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airportCode: location!.airport_code,
        locationCode: location!.code,
        name: 'Invalid Offering',
        phone: randomPhone(),
        email: 'invalid-offering@example.com',
        consent: true,
        offeringCode: 'not_a_real_offering',
      }),
    });
    expect(invalidOffering.status).toBe(400);
    await expect(invalidOffering.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });

    const { data: closedLocation } = await service
      .from('locations')
      .select('airport_code, code')
      .eq('is_open', false)
      .limit(1)
      .maybeSingle();
    expect(closedLocation).toBeTruthy();
    const closedJoin = await fetch(`${baseUrl}/functions/v1/queue_join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airportCode: closedLocation!.airport_code,
        locationCode: closedLocation!.code,
        name: 'Closed Location',
        phone: randomPhone(),
        email: 'closed-location@example.com',
        consent: true,
        offeringCode: 'chiropractic',
      }),
    });
    expect(closedJoin.status).toBe(400);
    await expect(closedJoin.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });

    const directBypass = await anon.rpc('join_queue_with_offering', {
      p_airport_code: location!.airport_code,
      p_location_code: location!.code,
      p_full_name: 'Bypass',
      p_phone_e164: randomPhone(),
      p_email: 'bypass@example.com',
      p_offering_code: 'chiropractic',
    });
    expect(directBypass.error).toBeTruthy();

    // Reserved fictional number outside randomPhone's range. Earlier cases
    // must not consume this test's exact five-request phone budget.
    const phone = '+12025550188';
    const buckets = [`phone:${phone}:hour`, `phone:${phone}:day`];
    expect((await service.from('api_rate_limits').delete().in('bucket', buckets)).error).toBeNull();
    let entryId: string | undefined;
    try {
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        const response = await fetch(`${baseUrl}/functions/v1/queue_join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            airportCode: location!.airport_code,
            locationCode: location!.code,
            name: 'Rate Limit Test',
            phone,
            email: 'rate-limit@example.com',
            consent: true,
            offeringCode: 'chiropractic',
          }),
        });
        if (attempt <= 5) {
          expect(response.status).toBe(200);
          const body = (await response.json()) as { queueEntryId?: string };
          entryId = body.queueEntryId;
        } else {
          expect(response.status).toBe(429);
        }
      }
    } finally {
      await service.from('api_rate_limits').delete().in('bucket', buckets);
      if (entryId) {
        await service.from('sms_outbox').delete().eq('queue_entry_id', entryId);
        await service.from('queue_entries').delete().eq('id', entryId);
      }
      await service.from('customers').delete().eq('phone_e164', phone);
    }
  });
});
