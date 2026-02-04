import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withCorsHeaders, corsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { normalizePhoneToE164 } from '../_shared/phone.ts';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitConfig,
} from '../_shared/rateLimit.ts';
import { getLocationIdForQueueEntry } from '../_shared/queue.ts';

type Payload = {
  queueEntryId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  serviceLabel?: string;
  customerType?: 'paying' | 'priority_pass';
};

const ALLOWED_CUSTOMER_TYPES = new Set(['paying', 'priority_pass']);

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

  const serviceLabel = payload.serviceLabel?.trim();
  if (!serviceLabel) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Service label is required' }), {
      status: 400,
      headers,
    });
  }

  if (!payload.customerType || !ALLOWED_CUSTOMER_TYPES.has(payload.customerType)) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Customer type is invalid' }), {
      status: 400,
      headers,
    });
  }

  const phoneE164 = normalizePhoneToE164(payload.phone ?? '');
  if (!phoneE164) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Valid phone number is required' }), {
      status: 400,
      headers,
    });
  }

  let auth;
  try {
    auth = await requireEmployee(authHeader);
  } catch (error) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unauthorized' }),
      { status: 403, headers }
    );
  }

  const { service, userId } = auth;

  const locationId = await getLocationIdForQueueEntry(
    service,
    payload.queueEntryId
  );
  if (locationId) {
    const rateLimit = await checkRateLimit(
      service,
      [
        {
          bucket: `user:${userId}`,
          limit: getRateLimitConfig('RATE_LIMIT_EMPLOYEE_USER_PER_MIN', 300),
          windowSeconds: 60,
        },
        {
          bucket: `location:${locationId}`,
          limit: getRateLimitConfig('RATE_LIMIT_EMPLOYEE_LOCATION_PER_MIN', 1000),
          windowSeconds: 60,
        },
      ],
      { endpoint: 'update_queue_entry', logContext: { userId, locationId } }
    );

    if (!rateLimit.allowed) {
      const headers = new Headers();
      withCorsHeaders(headers);
      return buildRateLimitResponse({
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        headers,
      });
    }
  }

  const { data: entry, error: entryError } = await service
    .from('queue_entries')
    .select('id, customer_id, queue_id, customer_type, status, service_label, customer:customers(full_name,email,phone_e164)')
    .eq('id', payload.queueEntryId)
    .maybeSingle();

  if (entryError) {
    console.error('update_queue_entry lookup failed', {
      error: entryError,
      queueEntryId: payload.queueEntryId,
    });
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: entryError.message || 'Failed to load queue entry' }),
      { status: 500, headers }
    );
  }

  if (!entry?.id || !entry.customer_id || !entry.queue_id) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: 'Queue entry not found' }),
      { status: 404, headers }
    );
  }

  const fullName = payload.fullName?.trim() || null;
  const email = payload.email?.trim().toLowerCase() || null;

  const existingCustomer =
    typeof entry?.customer === 'object' && entry?.customer
      ? (entry.customer as {
          full_name?: string | null;
          email?: string | null;
          phone_e164?: string | null;
        })
      : null;

  const noCustomerChanges =
    (existingCustomer?.full_name ?? null) === fullName &&
    (existingCustomer?.email ?? null) === email &&
    (existingCustomer?.phone_e164 ?? null) === phoneE164;

  const noQueueChanges =
    (entry.service_label ?? null) === serviceLabel &&
    entry.customer_type === payload.customerType;

  if (noCustomerChanges && noQueueChanges) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: 'No changes to apply' }),
      { status: 409, headers }
    );
  }

  const { error: customerError } = await service
    .from('customers')
    .update({
      full_name: fullName,
      email,
      phone_e164: phoneE164,
    })
    .eq('id', entry.customer_id);

  if (customerError) {
    console.error('update_queue_entry customer update failed', {
      error: customerError,
      customerId: entry.customer_id,
    });
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({
        error:
          customerError.code === '23505'
            ? 'Phone number already in use.'
            : customerError.message || 'Failed to update customer',
      }),
      { status: 400, headers }
    );
  }

  const updates: Record<string, unknown> = {
    service_label: serviceLabel,
    customer_type: payload.customerType,
  };

  if (entry.status === 'waiting' && payload.customerType !== entry.customer_type) {
    const { data: sortKeyData, error: sortKeyError } = await service.rpc(
      'next_sort_key',
      {
        p_queue_id: entry.queue_id,
        p_customer_type: payload.customerType,
      }
    );

    if (sortKeyError) {
      console.error('update_queue_entry sort_key lookup failed', {
        error: sortKeyError,
        queueEntryId: entry.id,
      });
      const headers = new Headers();
      withCorsHeaders(headers);
      return new Response(
        JSON.stringify({ error: 'Unable to reorder queue entry' }),
        { status: 500, headers }
      );
    }

    updates.sort_key = Number(sortKeyData ?? 0);
  }

  const { data: updated, error: updateError } = await service
    .from('queue_entries')
    .update(updates)
    .eq('id', entry.id)
    .select('id')
    .maybeSingle();

  if (updateError || !updated) {
    console.error('update_queue_entry queue update failed', {
      error: updateError,
      queueEntryId: entry.id,
    });
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: updateError?.message || 'No changes applied' }),
      { status: updateError ? 500 : 409, headers }
    );
  }

  await service.from('queue_events').insert({
    queue_entry_id: entry.id,
    actor_user_id: userId,
    event_type: 'edited_by_staff',
    payload: {
      service_label: serviceLabel,
      customer_type: payload.customerType,
    },
  });

  const headers = new Headers();
  withCorsHeaders(headers);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
});
