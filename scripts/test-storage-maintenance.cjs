// Requires psql and a disposable local PostgreSQL server. No production access.
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

async function main() {
  const url = new URL(process.env.STORAGE_TEST_DATABASE_URL || 'postgresql://localhost:54322/postgres');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Tests require a local database');
  const database = `storage_test_${process.pid}`;
  const parentUrl = url.toString();
  url.pathname = `/${database}`;
  const testUrl = url.toString();
  const sql = (query, target = testUrl) => execFileSync('psql', [target, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const migration = readFileSync(join(__dirname, '../supabase/migrations/20260905000000_bound_operational_storage.sql'), 'utf8');
  sql(`create database ${database};`, parentUrl);
  try {
    // Stub only the scheduler; execute the migration's real registered SQL below.
    sql(`
      create schema cron authorization postgres;
      create schema net authorization postgres;
      create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
      alter table cron.job owner to postgres;
      create function cron.schedule(text,text,text) returns bigint language sql as $$
        insert into cron.job(jobname,schedule,command) values ($1,$2,$3)
        on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid;
      $$;
      create table cron.job_run_details (runid int primary key, status text, end_time timestamptz);
      create table net._http_response (id int);
      create table public.api_rate_limits (bucket text primary key, count int default 0, reset_at timestamptz, updated_at timestamptz default now());
      alter table cron.job_run_details owner to postgres;
      alter table net._http_response owner to postgres;
      alter table public.api_rate_limits owner to postgres;
    `);
    sql(migration);
    sql(migration);
    assert.equal(sql('select count(*) from cron.job;'), '3', 'Schedule replay must not duplicate jobs');
    const jobs = JSON.parse(sql('select json_object_agg(jobname,command) from cron.job;'));
    assert.equal(sql("select string_agg(schedule,',' order by jobname) from cron.job;"), '20 9 * * *,30 9 * * *,22 9 * * *');
    sql(`
      insert into cron.job_run_details values
        (1,'succeeded',now()-interval '8 days'),
        (2,'succeeded',now()-interval '6 days'),
        (3,'failed',now()-interval '31 days'),
        (4,'failed',now()-interval '29 days'),
        (5,'running',now()-interval '60 days'),
        (6,'succeeded',null),(7,'failed',null),
        (8,'unrecognized',now()-interval '60 days');
      insert into public.api_rate_limits(bucket,reset_at) values
        ('expired',now()-interval '2 days'),('grace',now()-interval '12 hours'),
        ('active',now()+interval '1 hour'),('concurrent',now()-interval '2 days');
    `);
    sql(jobs.storage_cron_retention);
    assert.equal(sql('select string_agg(runid::text,\',\' order by runid) from cron.job_run_details;'), '2,4,5,6,7,8');

    const updater = spawn('psql', [testUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let updateOutput = '';
    let updateError = '';
    updater.stdout.on('data', data => { updateOutput += data; });
    updater.stderr.on('data', data => { updateError += data; });
    const finished = new Promise((resolve, reject) => {
      updater.on('error', reject);
      updater.on('close', code => code === 0 ? resolve() : reject(new Error(updateError)));
    });
    updater.stdin.end("begin; update public.api_rate_limits set reset_at=now()+interval '1 hour' where bucket='concurrent'; select 'locked'; select pg_sleep(2); commit;");
    const deadline = Date.now() + 5000;
    while (!updateOutput.includes('locked')) {
      assert(Date.now() < deadline, 'Concurrent update did not acquire its lock');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    sql(jobs.storage_rate_limit_retention);
    await finished;
    assert.equal(sql("select string_agg(bucket,',' order by bucket) from public.api_rate_limits;"), 'active,concurrent,grace');

    // Exercise the actual application's bucket recreation path in isolation.
    let rateMigration = readFileSync(join(__dirname, '../supabase/migrations/20260204000006_recreate_check_rate_limits.sql'), 'utf8');
    rateMigration = rateMigration.replace(/^revoke .*;$/gm, '').replace(/^grant .*;$/gm, '');
    sql(rateMigration);
    assert.equal(sql(`select allowed from public.check_rate_limits('[{"bucket":"expired","limit":3,"window_seconds":60}]');`), 't');
    assert.equal(sql("select count from public.api_rate_limits where bucket='expired';"), '1');
    // This fails if VACUUM accidentally becomes a multi-statement transaction.
    sql(jobs.storage_operational_vacuum);
    console.log('PASS: idempotent schedules; 7/30-day retention; unfinished/unknown preservation; active/grace/concurrent rate buckets; bucket recreation; standalone vacuum.');
  } finally {
    sql(`drop database ${database} with (force);`, parentUrl);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
