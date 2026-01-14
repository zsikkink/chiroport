import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withCorsHeaders, corsHeaders } from '../_shared/cors.ts';
import { requireEmployee } from '../_shared/employeeAuth.ts';
import { MESSAGE_TYPES } from '../_shared/messages.ts';
import { sendOutboxForEntry } from '../_shared/outbox.ts';

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

  let payload: { queueId?: string } = {};
  try {
    payload = (await req.json()) as { queueId?: string };
  } catch {
    payload = {};
  }

  if (!payload.queueId) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(JSON.stringify({ error: 'Queue id is required' }), {
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

  const { authed, service } = auth;

  const { data, error } = await authed.rpc('advance_queue', {
    p_queue_id: payload.queueId,
  });

  if (error || !data?.length) {
    const headers = new Headers();
    withCorsHeaders(headers);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to advance queue' }),
      { status: 403, headers }
    );
  }

  const result = data[0];
  if (result?.out_queue_entry_id) {
    try {
      await sendOutboxForEntry(
        service,
        result.out_queue_entry_id,
        MESSAGE_TYPES.NEXT
      );
    } catch (error) {
      console.error('advance_queue immediate send failed', error);
    }
  }

  const headers = new Headers();
  withCorsHeaders(headers);
  return new Response(
    JSON.stringify({
      queueEntryId: result.out_queue_entry_id,
      status: result.out_new_status,
      servedAt: result.out_served_at,
    }),
    { status: 200, headers }
  );
});
