// Synthetic application/auth restore drill. Never a production backup command.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  assert.equal(process.env.CHIROPORT_LOCAL_DEMO, '1', 'Explicit synthetic mode required');
  const url = new URL(process.env.SUPABASE_DB_URL);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Loopback database required');
  assert(['postgres:', 'postgresql:'].includes(url.protocol) && !url.search && !url.hash && url.pathname === '/postgres', 'Plain local PostgreSQL URL required; connection overrides are forbidden');
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  assert(['localhost', '127.0.0.1'].includes(api.hostname) && api.protocol === 'http:' && !api.username && !api.password && !api.search && !api.hash, 'Plain loopback API required');
  assert(!Object.keys(process.env).some(key => key.startsWith('TWILIO_') && process.env[key]), 'No provider configuration permitted');
  const project = process.env.CHIROPORT_LOCAL_PROJECT_ID;
  assert(/^chiroport_(impl|verify)_[a-z0-9]+$/.test(project), 'Uniquely owned disposable project required');
  const database = `chiroport_restore_${process.pid}`;
  const authContainer = `chiroport_restore_auth_${process.pid}`;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chiroport-synthetic-restore-'));
  const archive = path.join(directory, 'synthetic-public-auth.dump');
  const adminUrl = new URL(url); adminUrl.username = 'supabase_admin';
  const target = new URL(adminUrl); target.pathname = `/${database}`;
  // Explicit URL plus no libpq environment overrides; PGHOSTADDR can otherwise
  // redirect a localhost-looking connection to a different network address.
  const localEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
  const sql = (query, connection = target.toString()) => execFileSync('psql', [connection, '-X', '-At', '-v', 'ON_ERROR_STOP=1'], { env: localEnv, input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const dockerHost = process.env.DOCKER_HOST || docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
  assert(dockerHost.startsWith('unix://') || dockerHost.startsWith('npipe://'), 'Local Docker socket required');
  const databaseContainer = JSON.parse(docker(['inspect', `supabase_db_${project}`]))[0];
  const apiContainer = JSON.parse(docker(['inspect', `supabase_kong_${project}`]))[0];
  assert(databaseContainer.NetworkSettings.Ports['5432/tcp'].some(binding => binding.HostPort === url.port), 'DB port must belong to the named disposable project');
  assert(apiContainer.NetworkSettings.Ports['8000/tcp'].some(binding => binding.HostPort === api.port), 'API port must belong to the named disposable project');
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `restore-${process.pid}@example.invalid`, password = 'Synthetic-Only-2468!';
  const phone = '+12025550198';
  let userId, entryId, customerId;
  let createdDatabase = false, startedAuth = false;
  const started = Date.now();
  try {
    const { data: user, error: userError } = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(userError);
    userId = user.user.id;
    const { error: profileError } = await service.from('employee_profiles').insert({ user_id: userId, role: 'admin', is_open: true }); assert.ifError(profileError);
    const { data: location, error: locationError } = await service.from('locations').select('airport_code,code').eq('is_open', true).limit(1).single(); assert.ifError(locationError);
    const { data: joined, error } = await service.rpc('join_queue_with_offering', { p_airport_code: location.airport_code, p_location_code: location.code, p_full_name: 'Synthetic Recovery Visitor', p_phone_e164: phone, p_email: 'restore-visitor@example.invalid', p_offering_code: 'chiropractic' }); assert.ifError(error);
    entryId = joined[0].out_queue_entry_id;
    const { data: entry, error: entryError } = await service.from('queue_entries').select('customer_id').eq('id', entryId).single(); assert.ifError(entryError); customerId = entry.customer_id;
    // Own fresh database, no job definitions, Vault secrets or storage objects.
    execFileSync('pg_dump', [adminUrl.toString(), '--format=custom', '--schema=public', '--schema=auth', '--file', archive], { env: localEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    fs.chmodSync(archive, 0o600);
    sql(`create database ${database};`, adminUrl.toString()); createdDatabase = true;
    sql('drop schema public; create schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions;');
    execFileSync('pg_restore', ['--exit-on-error', '--dbname', target.toString(), archive], { env: localEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(sql(`select status from public.queue_entries where id='${entryId}';`), 'waiting');
    const digestQuery = `select md5(string_agg(to_jsonb(t)::text,',' order by t.queue_entry_id)) from public.queue_entries_legal_archive t;`;
    assert.equal(sql(digestQuery), sql(digestQuery, adminUrl.toString()), 'Legal snapshots must survive unchanged');
    assert.equal(sql("select has_function_privilege('anon','public.staff_queue_entry_action(uuid,text,uuid,uuid)','execute');"), 'f');
    assert.equal(sql("select has_function_privilege('service_role','public.staff_queue_entry_action(uuid,text,uuid,uuid)','execute');"), 't');
    sql(`select * from public.staff_queue_entry_action('${entryId}','serving','${userId}'); select * from public.staff_queue_entry_action('${entryId}','complete','${userId}');`);
    assert.equal(sql(`select status from public.queue_entries where id='${entryId}';`), 'completed');
    assert.equal(sql(`select count(*) from public.queue_events where queue_entry_id='${entryId}' and event_type in ('serving_by_staff','completed_by_staff');`), '2');
    assert.equal(sql(`select count(*) from public.sms_outbox where queue_entry_id='${entryId}' and message_type='serving' and provider_message_id is null;`), '1');
    assert.equal(sql(digestQuery), sql(digestQuery, adminUrl.toString()), 'Commands must not rewrite legal snapshots');
    sql(fs.readFileSync(path.join(__dirname, '../tests/fixtures/rollup-conservation.sql'), 'utf8'));

    // Start only the existing Auth image against the restored DB, on a random
    // loopback port. Never copy hosted settings or activate SMS/cron workers.
    const original = JSON.parse(docker(['inspect', `supabase_auth_${project}`]))[0];
    const network = Object.keys(original.NetworkSettings.Networks)[0];
    const authEnv = original.Config.Env.filter(value => !value.startsWith('GOTRUE_DB_DATABASE_URL=') && !value.startsWith('GOTRUE_SMTP_'));
    authEnv.push(`GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:postgres@supabase_db_${project}:5432/${database}`);
    docker(['run', '-d', '--name', authContainer, '--network', network, '-p', '127.0.0.1::9999', ...authEnv.flatMap(value => ['-e', value]), original.Config.Image]); startedAuth = true;
    const auth = JSON.parse(docker(['inspect', authContainer]))[0];
    const port = auth.NetworkSettings.Ports['9999/tcp'][0].HostPort;
    let signedIn = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/token?grant_type=password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (response.ok) { signedIn = (await response.json()).user?.id === userId; break; }
      } catch { /* startup readiness */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert(signedIn, 'Restored synthetic account must authenticate through Auth');
    console.log(JSON.stringify({ result: 'passed', restored: 'synthetic public/auth schema and data', login: true, queue_commands: true, legal_digests_match: true, effective_grants: true, rollup_conservation_replay_rebuild: true, provider_sends: 0, elapsed_seconds: (Date.now() - started) / 1000, archive, limitations: 'No production data, Vault, Storage objects, hosted configuration, cron activation, offsite custody, RPO or RTO assurance.' }));
  } finally {
    const failures = [];
    for (const cleanup of [
      () => { if (startedAuth) docker(['rm', '-f', authContainer]); },
      () => { if (createdDatabase) sql(`drop database ${database} with (force);`, adminUrl.toString()); },
      () => entryId && service.from('queue_entries').delete().eq('id', entryId),
      () => customerId && service.from('customers').delete().eq('id', customerId),
      () => userId && service.from('employee_profiles').delete().eq('user_id', userId),
      () => userId && service.auth.admin.deleteUser(userId),
    ]) {
      try { const result = await cleanup(); if (result?.error) throw result.error; } catch { failures.push('A synthetic resource needs cleanup'); }
    }
    if (failures.length) throw new Error(`${failures.length} cleanup failures; inspect disposable project ${project}`);
  }
}
main().catch(error => { const detail = (error.stderr?.toString() || error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[local database]'); console.error(`Synthetic restore failed: ${detail}`); process.exitCode = 1; });
