// Fresh, disposable local verification/demo. Never reads the checkout's env.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

async function main() {
  const demo = process.argv.includes('--demo');
  const capture = process.argv.includes('--capture-demo');
  if (process.argv.slice(2).some(arg => !['--demo', '--capture-demo'].includes(arg))) throw new Error('Only --demo and --capture-demo are supported');
  const source = path.resolve(__dirname, '..');
  for (const port of [3000, 54321, 54322, 54323, 54324]) {
    const occupied = await new Promise(resolve => {
      const connection = net.connect({ host: '127.0.0.1', port });
      connection.once('connect', () => { connection.destroy(); resolve(true); });
      connection.once('error', () => resolve(false));
    });
    if (occupied) throw new Error(`Port ${port} is occupied; stop only the owning local service yourself. No existing instance will be reset.`);
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chiroport-verify-'));
  const repo = path.join(directory, 'repo');
  const project = `chiroport_verify_${crypto.randomBytes(5).toString('hex')}`;
  const excluded = new Set(['.git', 'node_modules', '.next', '.vercel', '.temp', '.branches', '.npmrc', '.Rapp.history', 'test-results', 'playwright-report', 'coverage']);
  fs.cpSync(source, repo, { recursive: true, filter: file => {
    const name = path.basename(file);
    return !excluded.has(name) && !name.startsWith('.env') && !/^employees.*\.json$/.test(name) && !/\.(dump|log|tsbuildinfo)$/.test(name);
  } });
  const config = path.join(repo, 'supabase/config.toml');
  fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace(/^project_id\s*=.*$/m, `project_id = "${project}"`));
  const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'TERM'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, { CI: '1', SKIP_ENV_CHECK: '0', CHIROPORT_LOCAL_DEMO: '1', CHIROPORT_LOCAL_PROJECT_ID: project, CHIROPORT_ALLOW_REMOTE_TESTS: '0', CHIROPORT_ALLOW_REMOTE_DB_CHECK: '0', NEXT_TELEMETRY_DISABLED: '1', SUPABASE_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:3000', SEND_SMS_SECRET: 'synthetic-local-worker-only', NPM_CONFIG_USERCONFIG: '/dev/null', NPM_CONFIG_GLOBALCONFIG: path.join(directory, 'absent-npmrc'), PLAYWRIGHT_BROWSERS_PATH: path.join(directory, 'browsers'), DENO_DIR: path.join(directory, 'deno-cache') });
  const dockerHost = execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { env, encoding: 'utf8' }).trim();
  if (!dockerHost.startsWith('unix://') && !dockerHost.startsWith('npipe://')) throw new Error('A local Docker socket is required; remote contexts are refused');
  const services = [];
  const children = new Set();
  let interrupted = false, finishDemo;
  function interrupt() {
    interrupted = true;
    if (finishDemo) finishDemo();
    for (const child of children) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* exited */ } }
  }
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  const outcomes = [];
  let started = false;
  function command(label, program, args, background = false) {
    if (interrupted) throw new Error('Interrupted; cleaning up the disposable local project');
    const fd = fs.openSync(path.join(directory, `${label}.log`), 'w', 0o600);
    const child = spawn(program, args, { cwd: repo, env, stdio: ['ignore', fd, fd], detached: true });
    children.add(child);
    child.once('close', () => children.delete(child));
    fs.closeSync(fd);
    if (background) { child.once('error', interrupt); services.push(child); return child; }
    console.log(`${label}: running`);
    return new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', code => {
        outcomes.push({ label, command: [program, ...args].join(' '), exit_code: code });
        console.log(`${label}: exit ${code}`);
        if (code !== 0) reject(new Error(`${label} failed; inspect ${path.join(directory, `${label}.log`)}`));
        else resolve();
      });
    });
  }
  async function ready(url) {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (interrupted) throw new Error('Interrupted during local startup');
      try { if ((await fetch(url, { method: url.includes('functions/v1') ? 'OPTIONS' : 'GET', signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw new Error('Local runtime did not become ready');
  }
  function loadLocalEnvironment() {
    const local = execFileSync('supabase', ['status', '-o', 'env'], { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    for (const line of local.split('\n')) { const match = line.match(/^([A-Z_]+)="(.*)"$/); if (match) env[match[1]] = match[2]; }
    if (new URL(env.API_URL).hostname !== '127.0.0.1' || new URL(env.DB_URL).hostname !== '127.0.0.1') throw new Error('Unexpected non-loopback runtime');
    Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: env.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY, SUPABASE_SECRET_KEY: env.SECRET_KEY || env.SERVICE_ROLE_KEY, SUPABASE_DB_URL: env.DB_URL });
  }
  console.log(`Isolated verification: ${directory} (source is copied, never reset)`);
  try {
    await command('npm-ci', 'npm', ['ci']);
    await command('browser-install', 'npm', ['run', 'test:e2e:install', '--', 'chromium']);
    // Rehearse the recorded April baseline + already-applied September storage
    // migration. Move files only inside this fresh private copy, never Git.
    const migrations = path.join(repo, 'supabase/migrations');
    const heldMigrations = path.join(directory, 'pending-migrations');
    fs.mkdirSync(heldMigrations);
    const pending = fs.readdirSync(migrations).filter(name => name.endsWith('.sql') && name.slice(0, 14) > '20260428000000' && !name.startsWith('20260905000000_'));
    for (const name of pending) fs.renameSync(path.join(migrations, name), path.join(heldMigrations, name));
    started = true;
    await command('supabase-start', 'supabase', ['start']);
    loadLocalEnvironment();
    const sql = query => execFileSync('psql', [env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env, input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const beforeSql = `set role service_role; select row_to_json(j) from public.join_queue('HOU','west-concourse','Synthetic Upgrade Visitor','+12025550197','upgrade@example.invalid','paying',(select id from public.consent_versions where is_active and key='queue_join_consent_chiropractic' limit 1),'Chiropractor') j;`;
    fs.writeFileSync(path.join(directory, 'upgrade-fixture-before.sql'), beforeSql, { mode: 0o600 });
    const old = JSON.parse(sql(beforeSql));
    if (!/^[0-9a-f-]{36}$/.test(old.out_queue_entry_id) || !/^[0-9a-f-]{36}$/.test(old.out_public_token)) throw new Error('Legacy fixture failed');
    const legalQuery = `select md5(to_jsonb(t)::text) from public.queue_entries_legal_archive t where queue_entry_id='${old.out_queue_entry_id}';`;
    const legalBefore = sql(legalQuery);
    if (!legalBefore) throw new Error('Legacy consent snapshot missing');
    for (const name of pending) fs.renameSync(path.join(heldMigrations, name), path.join(migrations, name));
    await command('recorded-baseline-upgrade', 'supabase', ['migration', 'up', '--local', '--include-all']);
    await command('upgraded-privileges', 'npm', ['run', 'db:privileges:check']);
    if (sql(legalQuery) !== legalBefore) throw new Error('Upgrade altered original legal snapshot');
    if (sql(`set role anon; select status from public.get_visit('${old.out_public_token}');`) !== 'waiting') throw new Error('Published visit capability contract changed');
    const joined = JSON.parse(sql(`set role service_role; select row_to_json(j) from public.join_queue_with_offering('HOU','west-concourse','Synthetic Upgrade Visitor','+12025550197','upgrade@example.invalid','chiropractic') j;`));
    if (joined.out_queue_entry_id !== old.out_queue_entry_id) throw new Error('Upgrade duplicated an active legacy visit');
    fs.writeFileSync(path.join(directory, 'upgrade-result.json'), JSON.stringify({ pending_migrations: pending, consent_preserved: true, published_get_visit_preserved: true, canonical_join_deduplicates_legacy_visit: true, acl_allowlist_verified: true, limitation: 'Legacy internal join is intentionally revoked; actual deployed web/Edge artifact compatibility remains unverified.' }, null, 2), { mode: 0o600 });
    // Now independently replay the complete intended tree from zero. Only this
    // unique disposable project's volumes are discarded. A new start avoids
    // CLI reset's observed transient Auth/gateway 502 during container restart.
    await command('discard-upgrade-fixture', 'supabase', ['stop', '--project-id', project, '--no-backup']);
    await command('fresh-migration-replay', 'supabase', ['start']);
    loadLocalEnvironment();
    // This project's jobs must never activate real external effects. Tests
    // exercise registered maintenance SQL separately, not a live scheduler.
    sql('select cron.alter_job(jobid, active := false) from cron.job;');
    await command('application-check', 'npm', ['run', 'check']);
    await command('edge-check', 'npm', ['run', 'check:edge']);
    await command('database-types', 'npm', ['run', 'db:types:check']);
    await command('database-privileges', 'npm', ['run', 'db:privileges:check']);
    await command('jest', 'npm', ['test', '--', '--runInBand']);
    await command('operator-tests', 'node', ['--test', 'scripts/clear-queues.test.cjs', 'scripts/check-database-storage.test.cjs', 'scripts/local-safety.test.cjs']);
    env.STORAGE_TEST_DATABASE_URL = env.DB_URL;
    await command('storage-sql', 'node', ['scripts/test-storage-maintenance.cjs']);
    await command('synthetic-restore', 'node', ['scripts/test-local-recovery.cjs']);
    await command('production-build', 'npm', ['run', 'build']);
    command('edge-runtime', 'supabase', ['functions', 'serve', '--no-verify-jwt'], true);
    command('next-runtime', 'npm', ['start', '--', '--hostname', '127.0.0.1'], true);
    await ready(`${env.API_URL}/functions/v1/queue_join`);
    await ready('http://127.0.0.1:3000');
    if (capture) env.CHIROPORT_CAPTURE_DEMO = '1';
    await command('browser-regressions', 'npm', ['run', 'test:e2e', '--', '--workers=1']);
    if (capture) {
      const images = ['intake', 'joined', 'queue', 'serving', 'history', 'analytics'].map(name => `synthetic-${name}.png`);
      fs.mkdirSync(path.join(source, 'docs/images'), { recursive: true });
      for (const name of images) fs.copyFileSync(path.join(repo, 'docs/images', name), path.join(source, 'docs/images', name));
      const journey = fs.readdirSync(path.join(repo, 'test-results')).find(name => name.startsWith('product-journey-'));
      if (journey) fs.copyFileSync(path.join(repo, 'test-results', journey, 'video.webm'), path.join(source, 'docs/images/synthetic-walkthrough.webm'));
    }
    if (demo) {
      await command('demo-account', 'node', ['scripts/seed-local-demo.cjs']);
      console.log('Synthetic demo: http://127.0.0.1:3000 — employee login demo-staff@example.invalid / Synthetic-Only-2468! (local only). Ctrl-C to stop.');
      if (!interrupted) await new Promise(resolve => { finishDemo = resolve; });
    }
  } finally {
    for (const child of services.reverse()) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already stopped */ } }
    if (started) {
      try { execFileSync('supabase', ['stop', '--project-id', project, '--no-backup'], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { console.error(`Cleanup requires inspection of local project ${project}`); }
    }
    fs.writeFileSync(path.join(directory, 'outcomes.json'), JSON.stringify({ project, outcomes, production_access: false }, null, 2), { mode: 0o600 });
    console.log(`Evidence retained: ${directory}. Only this disposable project's data volumes were removed.`);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
