const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, MAINTENANCE_JOBS, evaluateWorkflow, monitorQuery } = require('./check-database-storage.cjs');

function healthy() {
  return {
    measured_at: '2026-09-06T14:00:00Z', total_bytes: 85e6,
    targets: { 'cron.job_run_details': 8e6, 'net._http_response': 1e6, 'public.api_rate_limits': 1e6 },
    jobs: [...MAINTENANCE_JOBS, 'send_sms_minutely', 'queue_daily_rollup', 'queue_rollup_sanity_check'].map(name => ({ name, active: true, last_success: '2026-09-06T13:59:00Z', failures_24h: 0 })),
    http: { last_success: '2026-09-06T13:59:00Z', requests_1h: 60, failures_1h: 2, expired: 0 },
    old_unfinished_cron: 0, overdue_cron: 0, overdue_rate_buckets: 0,
  };
}

test('normal allocation and occasional HTTP timeouts are healthy', () => {
  assert.deepEqual(evaluate(healthy()).alerts, []);
});

test('all capacity escalation thresholds are enforced', () => {
  for (const [mb, message] of [[250, 'Prepare archive'], [300, 'Start archive'], [350, 'URGENT'], [400, 'EMERGENCY']]) {
    const snapshot = healthy(); snapshot.total_bytes = mb * 1e6;
    assert(evaluate(snapshot).alerts.some(alert => alert.startsWith(message)));
  }
});

test('extension table bloat is detected even with small public data', () => {
  const snapshot = healthy(); snapshot.targets['net._http_response'] = 11e6;
  assert(evaluate(snapshot).alerts.some(alert => alert.includes('net._http_response')));
});

test('missing, stale and failed maintenance cannot silently pass', () => {
  const snapshot = healthy(); snapshot.jobs.shift();
  snapshot.jobs[0].last_success = '2026-09-04T00:00:00Z';
  snapshot.jobs[1].failures_24h = 1;
  assert.equal(evaluate(snapshot).alerts.length, 3);
});

test('HTTP health is checked independently of successful scheduler invocations', () => {
  const snapshot = healthy(); snapshot.http.last_success = '2026-09-06T12:00:00Z'; snapshot.http.failures_1h = 12;
  assert.equal(evaluate(snapshot).alerts.length, 2);
});

test('overdue and unfinished operational rows trigger investigation', () => {
  const snapshot = healthy(); snapshot.old_unfinished_cron = 1; snapshot.overdue_cron = 1; snapshot.overdue_rate_buckets = 1; snapshot.http.expired = 1;
  assert.equal(evaluate(snapshot).alerts.length, 4);
});

test('daily growth and forecast use real elapsed time and the correct project', () => {
  const snapshot = healthy();
  const history = [
    { project_ref: 'abxthfvmydedzajlcjlu', measured_at: '2026-08-07T14:00:00Z', total_bytes: 20e6 },
    { project_ref: 'abxthfvmydedzajlcjlu', measured_at: '2026-09-05T14:00:00Z', total_bytes: 70e6 },
  ];
  const result = evaluate(snapshot, history);
  assert(result.alerts.some(alert => alert.includes('10 MB/day')));
  assert(result.alerts.some(alert => alert.includes('180 days')));
  assert(result.projected_mb_per_year > 700);
  assert.deepEqual(evaluate(snapshot, history.map(sample => ({ ...sample, project_ref: 'different_project' }))).alerts, []);
});

test('a missed external check is actionable', () => {
  assert(evaluate(healthy(), [{ project_ref: 'abxthfvmydedzajlcjlu', measured_at: '2026-09-04T14:00:00Z', total_bytes: 85e6 }]).alerts.some(alert => alert.includes('monitor gap')));
});

test('missing measurements fail closed', () => {
  const snapshot = healthy(); delete snapshot.targets['net._http_response'];
  assert.throws(() => evaluate(snapshot), /Missing relation/);
  assert.throws(() => evaluate({ ...healthy(), total_bytes: null }), /Incomplete/);
});

// Synthetic test policy only — not approved production thresholds.
const workflowPolicy = { maxPendingMinutes: 10, maxSendingMinutes: 6, maxDeadMessages: 0, maxNewAnomalies: 0, anomaliesSince: '2026-09-01T00:00:00Z' };
function workflowSnapshot() {
  return { ...healthy(), workflow: { pending_count: 0, oldest_pending: null, sending_count: 0, oldest_sending: null, dead_count: 0, new_anomalies: 0 } };
}
test('successful cron and HTTP do not hide stalled messages or anomalies', () => {
  const snapshot = workflowSnapshot();
  Object.assign(snapshot.workflow, { pending_count: 2, oldest_pending: '2026-09-06T13:00:00Z', sending_count: 1, oldest_sending: '2026-09-06T13:30:00Z', dead_count: 1, new_anomalies: 1 });
  assert.deepEqual(evaluate(snapshot).alerts, []);
  assert.equal(evaluateWorkflow(snapshot, workflowPolicy).length, 4);
  assert.deepEqual(evaluateWorkflow(workflowSnapshot(), workflowPolicy), []);
});
test('workflow checks need explicit policy and complete valid measurements', () => {
  assert.throws(() => evaluateWorkflow(workflowSnapshot(), null), /policy/);
  assert.throws(() => evaluateWorkflow(healthy(), workflowPolicy), /measurement/);
  assert.throws(() => evaluateWorkflow({ ...workflowSnapshot(), workflow: { ...workflowSnapshot().workflow, dead_count: null } }, workflowPolicy), /measurement/);
  assert.throws(() => evaluateWorkflow({ ...workflowSnapshot(), workflow: { ...workflowSnapshot().workflow, sending_count: 1 } }, workflowPolicy), /oldest/);
});
test('workflow SQL is opt-in, aggregate-only, and normalizes its review checkpoint', () => {
  assert(!monitorQuery().includes('oldest_pending'));
  const sql = monitorQuery(workflowPolicy);
  assert(sql.includes('oldest_pending'));
  assert(sql.includes('detected_at>'));
  assert(sql.includes("last_error is null or last_error not in ('opted_out','superseded_queue_state','superseded_queue_move')"));
  assert(!sql.includes('to_phone'));
  assert(!sql.includes('body'));
  assert.throws(() => monitorQuery({ ...workflowPolicy, anomaliesSince: "'); delete from customers; --" }), /checkpoint/);
});
