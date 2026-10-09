// Read-only production monitor. Credentials and customer data are never logged.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { homedir } = require('node:os');
const { dirname, join } = require('node:path');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'abxthfvmydedzajlcjlu';
const STATE_PATH = process.env.CHIROPORT_STORAGE_STATE_PATH || join(homedir(), '.local/state/chiroport/storage-monitor.json');
const MAINTENANCE_JOBS = ['storage_cron_retention', 'storage_rate_limit_retention', 'storage_operational_vacuum'];
const QUERY = `
with relations as (
  select n.nspname||'.'||c.relname as name, pg_total_relation_size(c.oid) as bytes
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','m') and n.nspname not like 'pg_toast%'
), jobs as (
  select j.jobname as name,j.active,
    max(d.end_time) filter (where d.status='succeeded') as last_success,
    count(*) filter (where d.status='failed' and d.start_time>now()-interval '1 day') as failures_24h
  from cron.job j left join cron.job_run_details d on d.jobid=j.jobid
  group by j.jobid,j.jobname,j.active
)
select json_build_object(
  'measured_at',now(),
  'total_bytes',(select sum(pg_database_size(datname)) from pg_database),
  'relations',(select json_agg(r order by bytes desc) from (select * from relations order by bytes desc limit 20) r),
  'targets',(select json_object_agg(name,bytes) from relations where name in ('cron.job_run_details','net._http_response','public.api_rate_limits')),
  'jobs',(select json_agg(jobs) from jobs),
  'http',json_build_object(
    'last_success',(select max(created) from net._http_response where status_code between 200 and 299),
    'requests_1h',(select count(*) from net._http_response where created>now()-interval '1 hour'),
    'failures_1h',(select count(*) from net._http_response where created>now()-interval '1 hour' and (status_code is null or status_code not between 200 and 299)),
    'expired',(select count(*) from net._http_response where created<now()-interval '7 hours')
  ),
  'old_unfinished_cron',(select count(*) from cron.job_run_details where start_time<now()-interval '1 hour' and (end_time is null or status not in ('succeeded','failed'))),
  'overdue_cron',(select count(*) from cron.job_run_details where end_time is not null and ((status='succeeded' and end_time<now()-interval '9 days') or (status='failed' and end_time<now()-interval '32 days'))),
  'overdue_rate_buckets',(select count(*) from public.api_rate_limits where reset_at<now()-interval '3 days')
) as snapshot;
`;

function evaluate(snapshot, history = []) {
  if (!Number.isFinite(snapshot.total_bytes) || snapshot.total_bytes <= 0 || !Array.isArray(snapshot.jobs) || !snapshot.targets || !snapshot.http || !Number.isFinite(Date.parse(snapshot.measured_at))) {
    throw new Error('Incomplete storage measurement; do not treat this as healthy');
  }
  const alerts = [];
  const now = Date.parse(snapshot.measured_at);
  const ageHours = value => value ? (now - Date.parse(value)) / 3600000 : Infinity;
  const totalMB = snapshot.total_bytes / 1e6;
  if (totalMB >= 400) alerts.push('EMERGENCY: total database allocation >=400 MB');
  else if (totalMB >= 350) alerts.push('URGENT: total database allocation >=350 MB');
  else if (totalMB >= 300) alerts.push('Start archive rollout: total database allocation >=300 MB');
  else if (totalMB >= 250) alerts.push('Prepare archive plan: total database allocation >=250 MB');
  for (const [name, limit] of Object.entries({ 'cron.job_run_details': 15e6, 'net._http_response': 10e6, 'public.api_rate_limits': 3e6 })) {
    if (!Number.isFinite(snapshot.targets[name])) throw new Error(`Missing relation measurement: ${name}`);
    if (snapshot.targets[name] > limit) alerts.push(`${name} exceeds ${limit / 1e6} MB`);
  }
  for (const name of [...MAINTENANCE_JOBS, 'send_sms_minutely', 'queue_daily_rollup', 'queue_rollup_sanity_check']) {
    const job = snapshot.jobs.find(value => value.name === name);
    const maxAge = name === 'send_sms_minutely' ? 5 / 60 : name === 'queue_daily_rollup' ? 2 : 36;
    if (!job?.active || !Number.isFinite(Date.parse(job.last_success)) || ageHours(job.last_success) > maxAge) alerts.push(`${name}: missing, inactive, or no success within ${maxAge} hours`);
    if (job?.failures_24h > 0) alerts.push(`${name}: ${job.failures_24h} failed runs in 24 hours`);
  }
  if (!Number.isFinite(Date.parse(snapshot.http.last_success)) || ageHours(snapshot.http.last_success) > 1 / 6) alerts.push('No successful HTTP response within 10 minutes');
  if (snapshot.http.failures_1h >= 5 || (snapshot.http.requests_1h >= 10 && snapshot.http.failures_1h / snapshot.http.requests_1h > 0.1)) alerts.push('Elevated HTTP failure rate');
  for (const [name, count] of Object.entries({ expired_http: snapshot.http.expired, unfinished_cron: snapshot.old_unfinished_cron, overdue_cron: snapshot.overdue_cron, overdue_rate_buckets: snapshot.overdue_rate_buckets })) {
    if (!Number.isFinite(count)) throw new Error(`Missing retention measurement: ${name}`);
    if (count > 0) alerts.push(`${name}: ${count} records need investigation`);
  }
  const previous = history.filter(sample => sample.project_ref === PROJECT_REF && Date.parse(sample.measured_at) < now).sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  const last = previous.at(-1);
  if (last && ageHours(last.measured_at) > 36) alerts.push('External monitor gap exceeds 36 hours');
  const daily = previous.filter(sample => ageHours(sample.measured_at) >= 20 && ageHours(sample.measured_at) <= 48).at(-1);
  if (daily && (snapshot.total_bytes - daily.total_bytes) / (ageHours(daily.measured_at) / 24) > 10e6) alerts.push('Database allocation growth exceeds 10 MB/day');
  const trendStart = previous.find(sample => ageHours(sample.measured_at) >= 7 * 24 && ageHours(sample.measured_at) <= 35 * 24);
  const bytesPerDay = trendStart ? Math.max(0, (snapshot.total_bytes - trendStart.total_bytes) / (ageHours(trendStart.measured_at) / 24)) : null;
  if (bytesPerDay > 0 && snapshot.total_bytes < 400e6 && (400e6 - snapshot.total_bytes) / bytesPerDay <= 180) alerts.push('Projected to reach 400 MB within 180 days; start capacity work');
  return { alerts, total_mb: totalMB, projected_mb_per_year: bytesPerDay === null ? null : bytesPerDay * 365 / 1e6 };
}

// Optional workflow policy is deliberately not enabled by default: operational
// thresholds and an always-on runner require owner approval. Tests use fixtures.
function validateWorkflowPolicy(policy) {
  for (const field of ['maxPendingMinutes', 'maxSendingMinutes', 'maxDeadMessages', 'maxNewAnomalies']) {
    if (!Number.isFinite(policy?.[field]) || policy[field] < 0) throw new Error(`Explicit workflow policy required: ${field}`);
  }
  if (!Number.isFinite(Date.parse(policy?.anomaliesSince))) throw new Error('Explicit anomaly review checkpoint required');
  return policy;
}

function monitorQuery(policy) {
  if (!policy) return QUERY;
  validateWorkflowPolicy(policy);
  const since = new Date(policy.anomaliesSince).toISOString();
  return `with storage_snapshot as (${QUERY.trim().replace(/;$/, '')})
    select snapshot::jsonb || jsonb_build_object('workflow', jsonb_build_object(
      'pending_count',(select count(*) from public.sms_outbox where status in ('queued','failed')),
      'oldest_pending',(select min(created_at) from public.sms_outbox where status in ('queued','failed')),
      'sending_count',(select count(*) from public.sms_outbox where status='sending'),
      'oldest_sending',(select min(locked_at) from public.sms_outbox where status='sending'),
      'dead_count',(select count(*) from public.sms_outbox where status='dead' and (last_error is null or last_error not in ('opted_out','superseded_queue_state','superseded_queue_move'))),
      'new_anomalies',(select count(*) from public.queue_rollup_anomalies where detected_at>'${since}'::timestamptz)
    )) as snapshot from storage_snapshot;`;
}

function evaluateWorkflow(snapshot, policy) {
  validateWorkflowPolicy(policy);
  const data = snapshot?.workflow;
  const now = Date.parse(snapshot?.measured_at);
  if (!data || !Number.isFinite(now)) throw new Error('Missing workflow measurement');
  for (const field of ['pending_count', 'sending_count', 'dead_count', 'new_anomalies']) {
    if (!Number.isSafeInteger(data[field]) || data[field] < 0) throw new Error(`Invalid workflow measurement: ${field}`);
  }
  const alerts = [];
  for (const [kind, limit] of [['pending', policy.maxPendingMinutes], ['sending', policy.maxSendingMinutes]]) {
    if (!data[`${kind}_count`]) continue;
    const oldest = Date.parse(data[`oldest_${kind}`]);
    if (!Number.isFinite(oldest) || oldest > now) throw new Error(`Invalid oldest ${kind} measurement`);
    if ((now - oldest) / 60_000 > limit) alerts.push(`SMS ${kind} work exceeds configured ${limit}-minute age`);
  }
  if (data.dead_count > policy.maxDeadMessages) alerts.push('SMS terminal failures exceed configured count; inspect provider state before replay');
  if (data.new_anomalies > policy.maxNewAnomalies) alerts.push('New rollup anomalies exceed configured count; inspect before rebuilding');
  return alerts;
}

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  if (process.platform !== 'darwin') throw new Error('Set SUPABASE_ACCESS_TOKEN to a token with database_read permission');
  let token = execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'Supabase CLI', '-a', 'access-token', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  for (const [prefix, encoding] of [['go-keyring-base64:', 'base64'], ['go-keyring-encoded:', 'hex']]) {
    if (token.startsWith(prefix)) token = Buffer.from(token.slice(prefix.length), encoding).toString();
  }
  return token;
}

async function main() {
  if (!/^[a-z]{20}$/.test(PROJECT_REF)) throw new Error('Invalid Supabase project reference');
  const workflowPolicy = process.env.CHIROPORT_WORKFLOW_POLICY_PATH
    ? validateWorkflowPolicy(JSON.parse(fs.readFileSync(process.env.CHIROPORT_WORKFLOW_POLICY_PATH, 'utf8')))
    : null;
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query/read-only`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: monitorQuery(workflowPolicy) }), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Read-only storage check failed (HTTP ${response.status})`);
  const data = await response.json();
  const snapshot = data[0]?.snapshot;
  if (!snapshot) throw new Error('Storage endpoint returned no snapshot');
  let history = [];
  try { history = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(history)) throw new Error('Invalid monitor history');
  const result = evaluate(snapshot, history);
  if (workflowPolicy) result.alerts.push(...evaluateWorkflow(snapshot, workflowPolicy));
  const day = new Date(snapshot.measured_at).toISOString().slice(0, 10);
  const retained = history.filter(sample => sample.project_ref === PROJECT_REF && new Date(sample.measured_at).toISOString().slice(0, 10) !== day).slice(-365);
  retained.push({ project_ref: PROJECT_REF, measured_at: snapshot.measured_at, total_bytes: snapshot.total_bytes, targets: snapshot.targets });
  fs.mkdirSync(dirname(STATE_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(`${STATE_PATH}.tmp`, JSON.stringify(retained, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(`${STATE_PATH}.tmp`, STATE_PATH);
  console.log(JSON.stringify({ project_ref: PROJECT_REF, ...result, workflow_check: workflowPolicy ? 'configured' : 'not_configured', snapshot, history_path: STATE_PATH }, null, 2));
  if (result.alerts.length) process.exitCode = 1;
}

if (require.main === module) main().catch(error => { console.error(`Storage monitor unavailable: ${error.message}`); process.exitCode = 2; });
module.exports = { evaluate, MAINTENANCE_JOBS, evaluateWorkflow, monitorQuery };
