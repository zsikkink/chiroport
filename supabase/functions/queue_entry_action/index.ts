import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withCorsHeaders, corsHeaders } from '../_shared/cors.ts';
import {
  createAuthedClient,
  createServiceRoleClient,
} from '../_shared/supabaseClient.ts';
import { enqueueAndSendOutboxMessage } from '../_shared/outbox.ts';
import { MESSAGE_TYPES, buildServingNotification } from '../_shared/messages.ts';

const ALLOWED_ACTIONS = new Set([
  'complete',
  'cancel',
  'return',
  'delete',
  'move',
  'serving',
]);

type Payload = {
  queueEntryId?: string;
  action?: string;
  targetLocationId?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }

  let payload: Payload = {};
  try {
    payload = (await req.json()) as Payload;
  } catch {
    payload = {};
  }

  if (!payload.queueEntryId) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Queue entry id is required' }), {
      status: 400,
      headers,
    });
  }

  if (!payload.action || !ALLOWED_ACTIONS.has(payload.action)) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Action is invalid' }), {
      status: 400,
      headers,
    });
  }

  const authed = createAuthedClient(authHeader);
  const service = createServiceRoleClient();

  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData?.user) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }

  const { data: profile, error: profileError } = await service
    .from('employee_profiles')
    .select('role,is_open')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile?.is_open || !['employee', 'admin'].includes(profile.role)) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers,
    });
  }

  const { data: entry, error: entryError } = await service
    .from('queue_entries')
    .select('id, queue_id, customer_id, customer_type, status')
    .eq('id', payload.queueEntryId)
    .maybeSingle();

  if (entryError || !entry?.id || !entry.queue_id || !entry.customer_id) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Queue entry not found' }), {
      status: 404,
      headers,
    });
  }

  const nowIso = new Date().toISOString();

  try {
    switch (payload.action) {
      case 'complete':
        await service
          .from('queue_entries')
          .update({ status: 'completed', completed_at: nowIso })
          .eq('id', entry.id);
        await service.from('queue_events').insert({
          queue_entry_id: entry.id,
          actor_user_id: userData.user.id,
          event_type: 'completed_by_staff',
          payload: { source: 'queue_entry_action' },
        });
        break;
      case 'cancel':
        await service
          .from('queue_entries')
          .update({ status: 'cancelled', cancelled_at: nowIso })
          .eq('id', entry.id);
        await service.from('queue_events').insert({
          queue_entry_id: entry.id,
          actor_user_id: userData.user.id,
          event_type: 'cancelled_by_staff',
          payload: { source: 'queue_entry_action' },
        });
        break;
      case 'return':
        await service
          .from('queue_entries')
          .update({
            status: 'waiting',
            served_at: null,
            completed_at: null,
            cancelled_at: null,
            no_show_at: null,
          })
          .eq('id', entry.id);
        await service.from('queue_events').insert({
          queue_entry_id: entry.id,
          actor_user_id: userData.user.id,
          event_type: 'returned_to_queue',
          payload: { source: 'queue_entry_action' },
        });
        break;
      case 'serving':
        await service
          .from('queue_entries')
          .update({
            status: 'serving',
            served_at: nowIso,
            completed_at: null,
            cancelled_at: null,
            no_show_at: null,
          })
          .eq('id', entry.id);
        await service.from('queue_events').insert({
          queue_entry_id: entry.id,
          actor_user_id: userData.user.id,
          event_type: 'serving_by_staff',
          payload: { source: 'queue_entry_action' },
        });
        if (entry.customer_type === 'paying') {
          const { data: customerRow } = await service
            .from('customers')
            .select('phone_e164, full_name')
            .eq('id', entry.customer_id)
            .maybeSingle();
          if (customerRow?.phone_e164) {
            await enqueueAndSendOutboxMessage(service, {
              queue_entry_id: entry.id,
              message_type: MESSAGE_TYPES.SERVING,
              to_phone: customerRow.phone_e164,
              body: buildServingNotification(),
              status: 'queued',
              idempotency_key: `serving:${entry.id}`,
            });
          }
        }
        break;
      case 'move': {
        if (!payload.targetLocationId) {
          throw new Error('Target location is required');
        }
        const { data: currentLocation } = await service
          .from('queues')
          .select('location_id')
          .eq('id', entry.queue_id)
          .maybeSingle();
        if (!currentLocation?.location_id) {
          throw new Error('Current location not found');
        }
        const { data: currentLocationRow } = await service
          .from('locations')
          .select('airport_code')
          .eq('id', currentLocation.location_id)
          .maybeSingle();
        const { data: targetLocationRow } = await service
          .from('locations')
          .select('id, airport_code')
          .eq('id', payload.targetLocationId)
          .maybeSingle();
        if (!targetLocationRow?.id || !currentLocationRow?.airport_code) {
          throw new Error('Target location is invalid');
        }
        if (currentLocationRow.airport_code !== targetLocationRow.airport_code) {
          throw new Error('Can only move within the same airport');
        }
        const { data: queueRow } = await service
          .from('queues')
          .select('id')
          .eq('location_id', targetLocationRow.id)
          .eq('code', 'default')
          .eq('is_open', true)
          .maybeSingle();
        if (!queueRow?.id) {
          throw new Error('Target queue is unavailable');
        }
        const { data: sortRow } = await service
          .from('queue_entries')
          .select('sort_key')
          .eq('queue_id', queueRow.id)
          .eq('customer_type', entry.customer_type)
          .eq('status', 'waiting')
          .order('sort_key', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextSortKey = Number(sortRow?.sort_key ?? 0) + 1;

        await service
          .from('queue_entries')
          .update({
            queue_id: queueRow.id,
            status: 'waiting',
            sort_key: nextSortKey,
            served_at: null,
            completed_at: null,
            cancelled_at: null,
            no_show_at: null,
          })
          .eq('id', entry.id);

        await service.from('queue_events').insert({
          queue_entry_id: entry.id,
          actor_user_id: userData.user.id,
          event_type: 'moved_by_staff',
          payload: {
            from_location_id: currentLocation.location_id,
            to_location_id: targetLocationRow.id,
          },
        });
        break;
      }
      case 'delete':
        await service.from('queue_entries').delete().eq('id', entry.id);
        await service.from('queue_events').insert({
          queue_entry_id: entry.id,
          actor_user_id: userData.user.id,
          event_type: 'deleted_by_staff',
          payload: { source: 'queue_entry_action' },
        });
        break;
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action failed';
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers,
    });
  }

  const headers = new Headers();
  withCorsHeaders(headers);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
});
