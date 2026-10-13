const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const env = { PATH: process.env.PATH, CHIROPORT_LOCAL_DEMO: '1', SUPABASE_DB_URL: 'postgresql://postgres:synthetic@127.0.0.1:54322/postgres', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', CHIROPORT_LOCAL_PROJECT_ID: 'chiroport_verify_test' };

for (const action of ['start', 'edge', 'web', 'stop']) {
  test(`editable ${action} refuses the original checkout before invoking external tools`, () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'local-dev.cjs'), action], {
      env: { PATH: '/nonexistent', TWILIO_AUTH_TOKEN: 'synthetic-forbidden', SUPABASE_DB_URL: 'postgresql://example.invalid/postgres' },
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /original checkout is never operated on/);
    assert.doesNotMatch(result.stderr, /synthetic-forbidden|example\.invalid/);
  });
}

for (const suffix of ['?host=example.invalid', '?hostaddr=192.0.2.1', '?service=remote', '#override']) {
  test(`restore refuses libpq override ${suffix} before accessing a database`, () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'test-local-recovery.cjs')], { env: { ...env, SUPABASE_DB_URL: env.SUPABASE_DB_URL + suffix }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /connection overrides are forbidden/);
  });
}
test('synthetic environment checks run in CI and reject provider configuration', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chiroport-env-guard-'));
  try {
    const local = { ...env, CI: '1', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic', SUPABASE_SECRET_KEY: 'synthetic', SEND_SMS_SECRET: 'synthetic' };
    const run = extra => spawnSync(process.execPath, [path.join(__dirname, 'check-env.cjs')], { cwd: directory, env: { ...local, ...extra }, encoding: 'utf8' });
    assert.equal(run({}).status, 0);
    assert.match(run({}).stdout, /Local synthetic environment verified/);
    assert.equal(run({ TWILIO_AUTH_TOKEN: 'synthetic-forbidden' }).status, 1);
    assert.equal(run({ NEXT_PUBLIC_SUPABASE_URL: 'https://localhost.example.invalid' }).status, 1);
    assert.equal(run({ SUPABASE_SECRET_KEY: '' }).status, 1);
  } finally { fs.rmdirSync(directory); }
});
