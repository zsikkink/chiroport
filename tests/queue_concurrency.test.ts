/** @jest-environment node */
import { execFileSync, spawn } from 'node:child_process';
import { createServiceClient, getTestEnv, randomPhone } from './helpers/supabase';
const env = getTestEnv();
const itLocal = env?.serviceKey ? it : it.skip;

itLocal('two blocked concurrent serving commands serialize to one transition/event/notification', async () => {
  const dbUrl = new URL(process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(dbUrl.hostname)) throw new Error('Concurrency tests require local PostgreSQL');
  const service = createServiceClient(env!);
  const { data: location } = await service.from('locations').select('airport_code,code').eq('is_open', true).limit(1).single();
  const { data: joined, error } = await service.rpc('join_queue_with_offering', { p_airport_code: location!.airport_code, p_location_code: location!.code, p_full_name: 'Synthetic Concurrency', p_phone_e164: randomPhone(), p_email: 'concurrency@example.invalid', p_offering_code: 'chiropractic' });
  expect(error).toBeNull();
  const entryId = joined![0].out_queue_entry_id;
  if (!/^[0-9a-f-]{36}$/.test(entryId)) throw new Error('Invalid synthetic entry ID');
  const { data: entry } = await service.from('queue_entries').select('customer_id').eq('id', entryId).single();
  const locker = spawn('psql', [dbUrl.toString(), '-X', '-At', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  locker.stdout.on('data', chunk => { output += chunk; });
  const ended = new Promise<void>((resolve, reject) => { locker.on('error', reject); locker.on('close', code => code === 0 ? resolve() : reject(new Error('Synthetic lock session failed'))); });
  const waitFor = async (condition: () => boolean) => {
    const deadline = Date.now() + 8000;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error('Timed out coordinating real writers');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  };
  let calls: PromiseLike<{ error: unknown }>[] = [];
  try {
    locker.stdin.write(`begin; select id from public.queue_entries where id='${entryId}' for update; select 'LOCK_HELD';\n`);
    await waitFor(() => output.includes('LOCK_HELD'));
    // Start both writes now, then observe both waiting inside PostgreSQL before
    // releasing the blocker. Promise.all of reads/sequential calls cannot pass.
    calls = [1, 2].map(() => Promise.resolve(service.rpc('staff_queue_entry_action', { p_entry_id: entryId, p_action: 'serving', p_actor_user_id: null })));
    await waitFor(() => Number(execFileSync('psql', [dbUrl.toString(), '-X', '-At', '-c', "select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%staff_queue_entry_action%'"], { encoding: 'utf8' }).trim()) >= 2);
    locker.stdin.end('commit;\n');
    await ended;
    const results = await Promise.all(calls);
    expect(results.filter(result => !result.error)).toHaveLength(1);
    expect(results.filter(result => result.error)).toHaveLength(1);
    const persisted = await service.from('queue_entries').select('status,served_at').eq('id', entryId).single();
    expect(persisted.data).toMatchObject({ status: 'serving', served_at: expect.any(String) });
    const events = await service.from('queue_events').select('event_type').eq('queue_entry_id', entryId);
    expect(events.error).toBeNull();
    expect(events.data!.filter(row => row.event_type === 'serving_by_staff')).toHaveLength(1);
    const messages = await service.from('sms_outbox').select('message_type').eq('queue_entry_id', entryId);
    expect(messages.error).toBeNull();
    expect(messages.data!.filter(row => row.message_type === 'confirm')).toHaveLength(1);
    expect(messages.data!.filter(row => row.message_type === 'serving')).toHaveLength(1);
  } finally {
    if (!locker.stdin.writableEnded) locker.stdin.end('rollback;\n');
    await ended.catch(() => {});
    await Promise.allSettled(calls);
    await service.from('queue_entries').delete().eq('id', entryId);
    await service.from('customers').delete().eq('id', entry!.customer_id);
  }
}, 20_000);
