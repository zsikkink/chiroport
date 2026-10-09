/** @jest-environment node */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createAnonClient,
  createServiceClient,
  getTestEnv,
  randomPhone,
} from './helpers/supabase';

const env = getTestEnv();
const itIf = env?.serviceKey ? test : test.skip;

type JoinedVisit = {
  entryId: string;
  customerId: string;
  publicToken: string;
  phone: string;
};

type OpenLocation = {
  airport_code: string;
  code: string;
};

async function getOpenLocations(
  service: SupabaseClient,
  limit: number
): Promise<OpenLocation[]> {
  const { data, error } = await service
    .from('locations')
    .select('airport_code,code')
    .eq('is_open', true)
    .limit(limit);
  if (error) throw error;
  return data;
}

async function getOpenLocation(service: SupabaseClient) {
  const [location] = await getOpenLocations(service, 1);
  if (!location) throw new Error('No open location');
  return location;
}

async function joinVisit(
  service: SupabaseClient,
  offeringCode: string,
  phone = randomPhone(),
  requestedLocation?: OpenLocation
): Promise<JoinedVisit> {
  const location = requestedLocation ?? (await getOpenLocation(service));
  const { data, error } = await service.rpc('join_queue_with_offering', {
    p_airport_code: location.airport_code,
    p_location_code: location.code,
    p_full_name: 'Mutation Test',
    p_phone_e164: phone,
    p_email: 'mutation@example.com',
    p_offering_code: offeringCode,
  });
  if (error || !data?.[0]) throw error ?? new Error('Join failed');

  const { data: entry, error: entryError } = await service
    .from('queue_entries')
    .select('customer_id')
    .eq('id', data[0].out_queue_entry_id)
    .single();
  if (entryError || !entry) throw entryError ?? new Error('Entry not found');

  return {
    entryId: data[0].out_queue_entry_id,
    publicToken: data[0].out_public_token,
    customerId: entry.customer_id,
    phone,
  };
}

async function deleteVisits(service: SupabaseClient, visits: JoinedVisit[]) {
  const entryIds = visits.map((visit) => visit.entryId);
  const customerIds = visits.map((visit) => visit.customerId);
  if (entryIds.length) {
    await service.from('sms_inbound').delete().in('queue_entry_id', entryIds);
    await service.from('sms_outbox').delete().in('queue_entry_id', entryIds);
    await service.from('queue_entries').delete().in('id', entryIds);
  }
  if (customerIds.length) {
    await service.from('customers').delete().in('id', customerIds);
  }
}

describe('authoritative queue mutation commands', () => {
  itIf('uses one priority rule for join position, staff order, and automatic next selection', async () => {
    const service = createServiceClient(env!);
    const location = await getOpenLocation(service);
    const priorityPass = await joinVisit(
      service,
      'priority_pass',
      randomPhone(),
      location
    );
    const paying = await joinVisit(
      service,
      'chiropractic',
      randomPhone(),
      location
    );

    try {
      const joinPosition = await service.rpc('get_visit', {
        p_public_token: paying.publicToken,
      });
      expect(joinPosition.error).toBeNull();
      expect(joinPosition.data?.[0]?.queue_position).toBe(1);

      const { data: waiting, error: waitingError } = await service
        .from('employee_queue_waiting_view')
        .select('queue_entry_id,queue_position,priority_rank')
        .in('queue_entry_id', [priorityPass.entryId, paying.entryId])
        .order('queue_position');
      expect(waitingError).toBeNull();
      expect(waiting).toEqual([
        {
          queue_entry_id: paying.entryId,
          queue_position: 1,
          priority_rank: 0,
        },
        {
          queue_entry_id: priorityPass.entryId,
          queue_position: 2,
          priority_rank: 1,
        },
      ]);

      const { data: nextState } = await service
        .from('queue_entries')
        .select('id,next_notified_at')
        .in('id', [priorityPass.entryId, paying.entryId]);
      expect(nextState?.find((row) => row.id === paying.entryId)?.next_notified_at).toBeTruthy();
      expect(
        nextState?.find((row) => row.id === priorityPass.entryId)?.next_notified_at
      ).toBeNull();

      const queueId = waiting?.[0]
        ? (
            await service
              .from('queue_entries')
              .select('queue_id')
              .eq('id', paying.entryId)
              .single()
          ).data?.queue_id
        : null;
      const automatic = await service.rpc('advance_queue', {
        p_queue_id: queueId!,
      });
      expect(automatic.error).toBeNull();
      expect(automatic.data?.[0]?.out_queue_entry_id).toBe(paying.entryId);
    } finally {
      await deleteVisits(service, [priorityPass, paying]);
    }
  });

  itIf('keeps queue joining idempotent and preserves the active offering', async () => {
    const service = createServiceClient(env!);
    const visit = await joinVisit(service, 'chiropractic');

    try {
      const location = await getOpenLocation(service);
      const retry = await service.rpc('join_queue_with_offering', {
        p_airport_code: location.airport_code,
        p_location_code: location.code,
        p_full_name: 'Mutation Test',
        p_phone_e164: visit.phone,
        p_email: 'mutation@example.com',
        p_offering_code: 'priority_pass',
      });
      expect(retry.error).toBeNull();
      expect(retry.data?.[0]?.out_queue_entry_id).toBe(visit.entryId);

      const [
        { count: activeCount },
        { count: joinedEventCount },
        { data: confirmations },
        { data: activeEntry },
      ] =
        await Promise.all([
          service
            .from('queue_entries')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', visit.customerId)
            .in('status', ['waiting', 'serving']),
          service
            .from('queue_events')
            .select('id', { count: 'exact', head: true })
            .eq('queue_entry_id', visit.entryId)
            .eq('event_type', 'joined'),
          service
            .from('sms_outbox')
            .select('body,idempotency_key')
            .eq('queue_entry_id', visit.entryId)
            .eq('message_type', 'confirm'),
          service
            .from('queue_entries')
            .select('offering_code,customer_type,service_label')
            .eq('id', visit.entryId)
            .single(),
        ]);
      expect(activeCount).toBe(1);
      expect(joinedEventCount).toBe(1);
      expect(confirmations).toHaveLength(1);
      expect(confirmations?.[0]?.idempotency_key).toBe(
        `confirm:${visit.entryId}`
      );
      expect(confirmations?.[0]?.body).toMatch(/^Chiroport Msg: /);
      expect(activeEntry).toMatchObject({
        offering_code: 'chiropractic',
        customer_type: 'paying',
        service_label: 'Chiropractor',
      });
    } finally {
      await deleteVisits(service, [visit]);
    }
  });

  itIf('derives offering invariants and rejects unknown offerings', async () => {
    const service = createServiceClient(env!);
    const visit = await joinVisit(service, 'priority_pass');

    try {
      const { data: entry } = await service
        .from('queue_entries')
        .select('offering_code,service_label,customer_type,consent_version_id')
        .eq('id', visit.entryId)
        .single();
      expect(entry).toMatchObject({
        offering_code: 'priority_pass',
        service_label: 'Priority Pass',
        customer_type: 'priority_pass',
      });

      const { data: consent } = await service
        .from('consent_versions')
        .select('key')
        .eq('id', entry!.consent_version_id!)
        .single();
      expect(consent?.key).toBe('queue_join_consent_bodywork');

      const location = await getOpenLocation(service);
      const invalidPhone = randomPhone();
      const { error: invalidError } = await service.rpc(
        'join_queue_with_offering',
        {
          p_airport_code: location.airport_code,
          p_location_code: location.code,
          p_full_name: 'Invalid Offering',
          p_phone_e164: invalidPhone,
          p_email: 'invalid@example.com',
          p_offering_code: 'not_an_offering',
        }
      );
      expect(invalidError?.message).toContain('invalid or inactive');

      const { count } = await service
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('phone_e164', invalidPhone);
      expect(count).toBe(0);
    } finally {
      await deleteVisits(service, [visit]);
    }
  });

  itIf('commits an edit and its audit event together', async () => {
    const service = createServiceClient(env!);
    const visit = await joinVisit(service, 'priority_pass');
    const email = `edit-actor-${Date.now()}@example.com`;
    const { data: actor } = await service.auth.admin.createUser({
      email,
      password: 'TestPass123!',
      email_confirm: true,
    });
    const actorId = actor.user?.id;
    expect(actorId).toBeTruthy();

    try {
      const nextPhone = randomPhone();
      const { data, error } = await service.rpc('staff_edit_queue_entry', {
        p_entry_id: visit.entryId,
        p_actor_user_id: actorId!,
        p_full_name: 'Edited Customer',
        p_email: 'edited@example.com',
        p_phone_e164: nextPhone,
        p_offering_code: 'chiropractic',
      });
      expect(error).toBeNull();
      expect(data?.[0]).toMatchObject({
        out_customer_type: 'paying',
        out_service_label: 'Chiropractor',
        out_offering_code: 'chiropractic',
      });

      const [{ data: entry }, { data: customer }, { data: events }] =
        await Promise.all([
          service
            .from('queue_entries')
            .select('offering_code,service_label,customer_type')
            .eq('id', visit.entryId)
            .single(),
          service
            .from('customers')
            .select('full_name,email,phone_e164')
            .eq('id', visit.customerId)
            .single(),
          service
            .from('queue_events')
            .select('actor_user_id,event_type,payload')
            .eq('queue_entry_id', visit.entryId)
            .eq('event_type', 'edited_by_staff'),
        ]);
      expect(entry).toMatchObject({
        offering_code: 'chiropractic',
        service_label: 'Chiropractor',
        customer_type: 'paying',
      });
      expect(customer).toEqual({
        full_name: 'Edited Customer',
        email: 'edited@example.com',
        phone_e164: nextPhone,
      });
      expect(events).toHaveLength(1);
      expect(events?.[0]?.actor_user_id).toBe(actorId);
    } finally {
      await deleteVisits(service, [visit]);
      if (actorId) await service.auth.admin.deleteUser(actorId);
    }
  });

  itIf('rolls back the entire edit when a later invariant fails', async () => {
    const service = createServiceClient(env!);
    const visit = await joinVisit(service, 'priority_pass');
    const duplicatePhone = randomPhone();
    const { data: duplicateCustomer } = await service
      .from('customers')
      .insert({ phone_e164: duplicatePhone, full_name: 'Existing Customer' })
      .select('id')
      .single();
    const { data: actor } = await service.auth.admin.createUser({
      email: `rollback-actor-${Date.now()}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    });
    const actorId = actor.user?.id;

    try {
      const { error } = await service.rpc('staff_edit_queue_entry', {
        p_entry_id: visit.entryId,
        p_actor_user_id: actorId!,
        p_full_name: 'Must Roll Back',
        p_email: 'rollback@example.com',
        p_phone_e164: duplicatePhone,
        p_offering_code: 'chiropractic',
      });
      expect(error?.code).toBe('23505');

      const [{ data: entry }, { data: customer }, { count: eventCount }] =
        await Promise.all([
          service
            .from('queue_entries')
            .select('offering_code,service_label,customer_type')
            .eq('id', visit.entryId)
            .single(),
          service
            .from('customers')
            .select('full_name,email,phone_e164')
            .eq('id', visit.customerId)
            .single(),
          service
            .from('queue_events')
            .select('id', { count: 'exact', head: true })
            .eq('queue_entry_id', visit.entryId)
            .eq('event_type', 'edited_by_staff'),
        ]);
      expect(entry).toMatchObject({
        offering_code: 'priority_pass',
        service_label: 'Priority Pass',
        customer_type: 'priority_pass',
      });
      expect(customer).toMatchObject({
        full_name: 'Mutation Test',
        email: 'mutation@example.com',
        phone_e164: visit.phone,
      });
      expect(eventCount).toBe(0);
    } finally {
      await deleteVisits(service, [visit]);
      if (duplicateCustomer?.id) {
        await service.from('customers').delete().eq('id', duplicateCustomer.id);
      }
      if (actorId) await service.auth.admin.deleteUser(actorId);
    }
  });

  itIf('atomically cancels, audits, and enqueues one durable acknowledgement', async () => {
    const service = createServiceClient(env!);
    const visit = await joinVisit(service, 'chiropractic');

    try {
      const first = await service.rpc('customer_cancel_queue_entry', {
        p_entry_id: visit.entryId,
        p_source: 'twilio_webhook',
        p_enqueue_ack: true,
      });
      expect(first.error).toBeNull();
      expect(first.data?.[0]?.out_outbox_id).toBeTruthy();

      const retry = await service.rpc('customer_cancel_queue_entry', {
        p_entry_id: visit.entryId,
        p_source: 'twilio_webhook',
        p_enqueue_ack: true,
      });
      expect(retry.error).toBeNull();
      expect(retry.data?.[0]?.out_outbox_id).toBe(
        first.data?.[0]?.out_outbox_id
      );

      const [{ data: entry }, { data: events }, { data: outbox }] =
        await Promise.all([
          service
            .from('queue_entries')
            .select('status,cancelled_at')
            .eq('id', visit.entryId)
            .single(),
          service
            .from('queue_events')
            .select('event_type,payload')
            .eq('queue_entry_id', visit.entryId)
            .eq('event_type', 'cancelled_by_customer'),
          service
            .from('sms_outbox')
            .select('message_type,status,idempotency_key')
            .eq('queue_entry_id', visit.entryId)
            .eq('message_type', 'cancel_ack'),
        ]);
      expect(entry?.status).toBe('cancelled');
      expect(entry?.cancelled_at).toBeTruthy();
      expect(events).toHaveLength(1);
      expect(events?.[0]?.payload).toMatchObject({ source: 'twilio_webhook' });
      expect(outbox).toHaveLength(1);
      expect(outbox?.[0]).toMatchObject({
        message_type: 'cancel_ack',
        status: 'queued',
        idempotency_key: `cancel_ack:${visit.entryId}`,
      });
    } finally {
      await deleteVisits(service, [visit]);
    }
  });

  itIf('atomically enqueues a manual staff message with a truthful queued event', async () => {
    const service = createServiceClient(env!);
    const visit = await joinVisit(service, 'chiropractic');
    const { data: actor } = await service.auth.admin.createUser({
      email: `message-actor-${Date.now()}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    });
    const actorId = actor.user?.id;
    expect(actorId).toBeTruthy();

    try {
      const rolledBack = await service.rpc('staff_enqueue_message', {
        p_entry_id: visit.entryId,
        p_actor_user_id: crypto.randomUUID(),
        p_body: 'This transaction must roll back',
      });
      expect(rolledBack.error).toBeTruthy();

      const [{ count: rolledBackRows }, { count: rolledBackEvents }] =
        await Promise.all([
          service
            .from('sms_outbox')
            .select('id', { count: 'exact', head: true })
            .eq('queue_entry_id', visit.entryId)
            .like('message_type', 'staff_%'),
          service
            .from('queue_events')
            .select('id', { count: 'exact', head: true })
            .eq('queue_entry_id', visit.entryId)
            .eq('event_type', 'staff_message_queued'),
        ]);
      expect(rolledBackRows).toBe(0);
      expect(rolledBackEvents).toBe(0);

      const queued = await service.rpc('staff_enqueue_message', {
        p_entry_id: visit.entryId,
        p_actor_user_id: actorId!,
        p_body: 'Please return to the front desk.',
      });
      expect(queued.error).toBeNull();
      expect(queued.data?.[0]?.out_outbox_id).toBeTruthy();

      const [{ data: outbox }, { data: events }] = await Promise.all([
        service
          .from('sms_outbox')
          .select('id,message_type,status,body')
          .eq('id', queued.data![0]!.out_outbox_id)
          .single(),
        service
          .from('queue_events')
          .select('actor_user_id,event_type,payload')
          .eq('queue_entry_id', visit.entryId)
          .eq('event_type', 'staff_message_queued'),
      ]);
      expect(outbox).toMatchObject({
        id: queued.data?.[0]?.out_outbox_id,
        status: 'queued',
        body: 'Please return to the front desk.',
      });
      expect(outbox?.message_type).toMatch(/^staff_/);
      expect(events).toHaveLength(1);
      expect(events?.[0]).toMatchObject({
        actor_user_id: actorId,
        event_type: 'staff_message_queued',
        payload: { outbox_id: queued.data?.[0]?.out_outbox_id },
      });
    } finally {
      await deleteVisits(service, [visit]);
      if (actorId) await service.auth.admin.deleteUser(actorId);
    }
  });

  itIf('rejects cancellation after completion without partial writes', async () => {
    const service = createServiceClient(env!);
    const visit = await joinVisit(service, 'chiropractic');

    try {
      const complete = await service.rpc('staff_queue_entry_action', {
        p_entry_id: visit.entryId,
        p_action: 'complete',
        p_target_location_id: null,
        p_actor_user_id: null,
      });
      expect(complete.error).toBeNull();

      const cancel = await service.rpc('customer_cancel_queue_entry', {
        p_entry_id: visit.entryId,
        p_source: 'test',
        p_enqueue_ack: true,
      });
      expect(cancel.error?.message).toContain('not cancellable');

      const [{ data: entry }, { count: eventCount }, { count: outboxCount }] =
        await Promise.all([
          service
            .from('queue_entries')
            .select('status,completed_at,cancelled_at')
            .eq('id', visit.entryId)
            .single(),
          service
            .from('queue_events')
            .select('id', { count: 'exact', head: true })
            .eq('queue_entry_id', visit.entryId)
            .eq('event_type', 'cancelled_by_customer'),
          service
            .from('sms_outbox')
            .select('id', { count: 'exact', head: true })
            .eq('queue_entry_id', visit.entryId)
            .eq('message_type', 'cancel_ack'),
        ]);
      expect(entry?.status).toBe('completed');
      expect(entry?.completed_at).toBeTruthy();
      expect(entry?.cancelled_at).toBeNull();
      expect(eventCount).toBe(0);
      expect(outboxCount).toBe(0);
    } finally {
      await deleteVisits(service, [visit]);
    }
  });

  itIf('does not expose service-only mutation commands to anonymous clients', async () => {
    const service = createServiceClient(env!);
    const anon = createAnonClient(env!);
    const visit = await joinVisit(service, 'chiropractic');

    try {
      const { error } = await anon.rpc('customer_cancel_queue_entry', {
        p_entry_id: visit.entryId,
        p_source: 'untrusted_client',
        p_enqueue_ack: true,
      });
      expect(error).toBeTruthy();

      const { error: editError } = await anon.rpc('staff_edit_queue_entry', {
        p_entry_id: visit.entryId,
        p_actor_user_id: crypto.randomUUID(),
        p_full_name: 'Unauthorized Edit',
        p_email: 'unauthorized@example.com',
        p_phone_e164: randomPhone(),
        p_offering_code: 'priority_pass',
      });
      expect(editError).toBeTruthy();

      const { data: entry } = await service
        .from('queue_entries')
        .select('status,offering_code')
        .eq('id', visit.entryId)
        .single();
      expect(entry).toMatchObject({
        status: 'waiting',
        offering_code: 'chiropractic',
      });
    } finally {
      await deleteVisits(service, [visit]);
    }
  });
});

describe('inbound SMS visit identity', () => {
  itIf('associates each message with the active visit for a returning phone', async () => {
    const service = createServiceClient(env!);
    const phone = randomPhone();
    const firstVisit = await joinVisit(service, 'chiropractic', phone);
    const visits = [firstVisit];

    try {
      const firstMessage = await service.rpc('record_sms_inbound', {
        p_from_phone: phone,
        p_to_phone: '+15555550100',
        p_body: 'First visit message',
        p_provider_message_id: `SM${Date.now()}A`,
        p_raw: { source: 'test' },
      });
      expect(firstMessage.error).toBeNull();
      expect(firstMessage.data?.[0]?.out_queue_entry_id).toBe(firstVisit.entryId);

      const cancel = await service.rpc('customer_cancel_queue_entry', {
        p_entry_id: firstVisit.entryId,
        p_source: 'test',
        p_enqueue_ack: false,
      });
      expect(cancel.error).toBeNull();

      const secondVisit = await joinVisit(service, 'priority_pass', phone);
      visits.push(secondVisit);
      const secondMessage = await service.rpc('record_sms_inbound', {
        p_from_phone: phone,
        p_to_phone: '+15555550100',
        p_body: 'Second visit message',
        p_provider_message_id: `SM${Date.now()}B`,
        p_raw: { source: 'test' },
      });
      expect(secondMessage.error).toBeNull();
      expect(secondMessage.data?.[0]?.out_queue_entry_id).toBe(
        secondVisit.entryId
      );

      const { data: inbound } = await service
        .from('sms_inbound')
        .select('queue_entry_id,body')
        .in('queue_entry_id', [firstVisit.entryId, secondVisit.entryId]);
      expect(inbound).toEqual(
        expect.arrayContaining([
          {
            queue_entry_id: firstVisit.entryId,
            body: 'First visit message',
          },
          {
            queue_entry_id: secondVisit.entryId,
            body: 'Second visit message',
          },
        ])
      );
    } finally {
      await deleteVisits(service, visits);
    }
  });

  itIf('leaves visit identity unset when a phone has multiple active visits', async () => {
    const service = createServiceClient(env!);
    const locations = await getOpenLocations(service, 2);
    expect(locations).toHaveLength(2);
    const phone = randomPhone();
    const firstVisit = await joinVisit(
      service,
      'chiropractic',
      phone,
      locations[0]
    );
    const secondVisit = await joinVisit(
      service,
      'priority_pass',
      phone,
      locations[1]
    );

    try {
      const messageId = `SM${Date.now()}AMBIGUOUS`;
      const message = await service.rpc('record_sms_inbound', {
        p_from_phone: phone,
        p_to_phone: '+15555550100',
        p_body: 'Which active visit?',
        p_provider_message_id: messageId,
        p_raw: { source: 'test' },
      });
      expect(message.error).toBeNull();
      expect(message.data?.[0]?.out_queue_entry_id).toBeNull();

      const { data: inbound } = await service
        .from('sms_inbound')
        .select('queue_entry_id,from_phone,body')
        .eq('provider_message_id', messageId)
        .single();
      expect(inbound).toEqual({
        queue_entry_id: null,
        from_phone: phone,
        body: 'Which active visit?',
      });
    } finally {
      await deleteVisits(service, [firstVisit, secondVisit]);
      await service
        .from('sms_inbound')
        .delete()
        .eq('from_phone', phone)
        .is('queue_entry_id', null);
    }
  });
});
