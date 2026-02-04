import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1?target=deno';

export async function getLocationIdForQueueEntry(
  supabase: SupabaseClient,
  queueEntryId: string
) {
  const { data, error } = await supabase
    .from('queue_entries')
    .select('queue:queues(location_id)')
    .eq('id', queueEntryId)
    .maybeSingle();

  if (error) {
    console.error('rate limit location lookup failed', {
      error,
      queueEntryId,
    });
    return null;
  }

  const queue = data?.queue as { location_id?: string } | null;
  return queue?.location_id ?? null;
}

export async function getLocationIdForQueue(
  supabase: SupabaseClient,
  queueId: string
) {
  const { data, error } = await supabase
    .from('queues')
    .select('location_id')
    .eq('id', queueId)
    .maybeSingle();

  if (error) {
    console.error('rate limit queue lookup failed', { error, queueId });
    return null;
  }

  return data?.location_id ?? null;
}
