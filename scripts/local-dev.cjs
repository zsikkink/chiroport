#!/usr/bin/env node
// Persistent, synthetic-only editable workspace. Never reads the checkout's env.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');

const action = process.argv[2];
const source = path.resolve(__dirname, '..');
const manifestName = 'chiroport-local-dev.json';
const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'TERM'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, { CHIROPORT_LOCAL_DEMO: '1', CHIROPORT_ALLOW_REMOTE_TESTS: '0', CHIROPORT_ALLOW_REMOTE_DB_CHECK: '0', NEXT_TELEMETRY_DISABLED: '1', SUPABASE_TELEMETRY_DISABLED: '1', SKIP_ENV_CHECK: '0', NPM_CONFIG_USERCONFIG: '/dev/null' });

function read(program, args, cwd = source, input) {
  try {
    return execFileSync(program, args, { cwd, env, input, encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new Error(`${program} read/check failed or timed out; no command output or credentials are printed.`);
  }
}

function prerequisites() {
  if (!['darwin', 'linux'].includes(process.platform) || process.versions.node.split('.')[0] !== '22') throw new Error('This recipe requires macOS/Linux and Node 22; native Windows is unvalidated.');
  for (const [program, args, required] of [['supabase', ['--version'], /^2\.67\.1$/], ['deno', ['--version'], /^deno 2\.7\.7\b/], ['npm', ['--version'], /^\d+\./], ...['psql', 'pg_dump', 'pg_restore'].map(program => [program, ['--version'], /PostgreSQL/])]) {
    if (!required.test(read(program, args))) throw new Error(`Unexpected ${program} version; see README prerequisites.`);
  }
  const dockerHost = read('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
  if (!dockerHost.startsWith('unix://')) throw new Error('A local Docker Unix socket is required; remote contexts are refused.');
  read('docker', ['version', '--format', '{{.Server.Version}}']);
  return dockerHost;
}

async function freePort(port) {
  const occupied = await new Promise(resolve => {
    const connection = net.connect({ host: '127.0.0.1', port });
    connection.setTimeout(1500);
    connection.once('connect', () => { connection.destroy(); resolve(true); });
    connection.once('error', () => { connection.destroy(); resolve(false); });
    connection.once('timeout', () => { connection.destroy(); resolve(true); });
  });
  if (occupied) throw new Error(`Port ${port} is occupied or unavailable. Stop only the owning local service yourself; no existing project is reset.`);
}

function owned() {
  const directory = path.dirname(source);
  const manifest = path.join(directory, manifestName);
  if (!fs.existsSync(manifest) || fs.lstatSync(manifest).isSymbolicLink()) throw new Error('Run this command inside the generated editable workspace; the original checkout is never operated on.');
  const state = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const config = fs.readFileSync(path.join(source, 'supabase/config.toml'), 'utf8');
  if (state.workspace !== fs.realpathSync(source) || !/^chiroport_dev_[0-9a-f]{16}$/.test(state.project) || !config.includes(`project_id = "${state.project}"`) || fs.existsSync(path.join(source, '.git')) || fs.existsSync(path.join(source, 'supabase/.temp/project-ref'))) throw new Error('Workspace ownership/configuration guard failed; no local service was changed.');
  if (prerequisites() !== state.dockerHost) throw new Error('Docker context changed; inspect the original local context before resuming.');
  env.NPM_CONFIG_GLOBALCONFIG = path.join(directory, 'absent-npmrc');
  env.DENO_DIR = path.join(directory, 'deno-cache');
  env.PLAYWRIGHT_BROWSERS_PATH = path.join(directory, 'browsers');
  env.CHIROPORT_LOCAL_PROJECT_ID = state.project;
  return { directory, manifest, state };
}

async function command(ownership, label, program, args, foreground = false) {
  const logfile = path.join(ownership.directory, `${label}.log`);
  const fd = fs.openSync(logfile, 'w', 0o600);
  fs.chmodSync(logfile, 0o600);
  console.log(`${label}: ${foreground ? 'running; Ctrl-C stops only this process' : 'running'} (private log: ${logfile})`);
  await new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd: source, env, detached: true, stdio: ['ignore', fd, fd] });
    fs.closeSync(fd);
    const stop = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* exited */ } };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('error', () => reject(new Error(`${label} could not start; inspect its private log.`)));
    child.once('close', (code, signal) => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      if (code === 0 || (foreground && signal === 'SIGTERM')) resolve();
      else reject(new Error(`${label} failed; inspect its private log. Synthetic data is retained; do not reset another project.`));
    });
  });
}

function localEnvironment(ownership) {
  if (fs.readdirSync(source).some(name => name.startsWith('.env') && !['.env.local', '.env.edge.local'].includes(name))) throw new Error('Unexpected environment file in the synthetic workspace; inspect it privately before continuing.');
  const status = read('supabase', ['status', '-o', 'env']);
  const values = {};
  for (const line of status.split('\n')) { const match = line.match(/^([A-Z_]+)="(.*)"$/); if (match) values[match[1]] = match[2]; }
  const api = new URL(values.API_URL);
  const database = new URL(values.DB_URL);
  if (api.origin !== 'http://127.0.0.1:54321' || api.pathname !== '/' || api.username || api.password || api.search || api.hash || database.protocol !== 'postgresql:' || database.hostname !== '127.0.0.1' || database.port !== '54322' || database.username !== 'postgres' || database.pathname !== '/postgres' || database.search || database.hash || !values.ANON_KEY || !(values.SECRET_KEY || values.SERVICE_ROLE_KEY)) throw new Error('Unexpected local runtime; hosted targets and connection overrides are refused.');
  for (const [service, internalPort, hostPort] of [['db', '5432/tcp', database.port], ['kong', '8000/tcp', api.port]]) {
    const container = `supabase_${service}_${ownership.state.project}`;
    const ports = JSON.parse(read('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]));
    if (read('docker', ['inspect', '--format', '{{.State.Running}}', container]) !== 'true' || !ports[internalPort]?.some(binding => binding.HostPort === hostPort && ['0.0.0.0', '127.0.0.1', '::', '::1'].includes(binding.HostIp))) throw new Error('API/DB ports do not belong to the named owned project; no database/API traffic was performed.');
  }
  const app = { CHIROPORT_LOCAL_DEMO: '1', CHIROPORT_LOCAL_PROJECT_ID: ownership.state.project, CHIROPORT_ALLOW_REMOTE_TESTS: '0', CHIROPORT_ALLOW_REMOTE_DB_CHECK: '0', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:3000', NEXT_PUBLIC_SUPABASE_URL: api.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY, SUPABASE_SECRET_KEY: values.SECRET_KEY || values.SERVICE_ROLE_KEY, SUPABASE_DB_URL: values.DB_URL, SEND_SMS_SECRET: 'synthetic-local-worker-only', ALLOWED_ORIGINS: 'http://127.0.0.1:3000,http://localhost:3000' };
  Object.assign(env, app);
  // Status supplies only this owned local runtime. Do not preserve arbitrary
  // edits to .env.local or inherit any provider/hosted configuration.
  for (const [file, contents] of [['.env.local', app], ['.env.edge.local', { CHIROPORT_LOCAL_DEMO: '1', SEND_SMS_SECRET: app.SEND_SMS_SECRET, ALLOWED_ORIGINS: app.ALLOWED_ORIGINS }]]) {
    const target = path.join(source, file);
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Environment-file symlinks are refused.');
    fs.writeFileSync(target, Object.entries(contents).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(target, 0o600);
  }
  // Never expose the database URL in process arguments or command output.
  Object.assign(env, { PGHOST: database.hostname, PGPORT: database.port, PGUSER: database.username, PGPASSWORD: decodeURIComponent(database.password), PGDATABASE: 'postgres' });
  read('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], source, 'select cron.alter_job(jobid, active := false) from cron.job;');
  if (read('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], source, 'select count(*) from cron.job where active;') !== '0') throw new Error('Owned local cron jobs remain active; application/Edge traffic was not started.');
  console.log('Loopback environment verified; owned cron disabled, provider credentials absent.');
}

async function main() {
  if (process.argv.length !== 3 || !['create', 'start', 'edge', 'web', 'stop'].includes(action)) throw new Error('Usage: node scripts/local-dev.cjs create|start|edge|web|stop');
  if (action === 'create') {
    if (fs.existsSync(path.join(path.dirname(source), manifestName))) throw new Error('Use start in an existing workspace; create must run from the original checkout.');
    const dockerHost = prerequisites();
    for (const port of [3000, 54321, 54322, 54323, 54324]) await freePort(port);
    const project = `chiroport_dev_${crypto.randomBytes(8).toString('hex')}`;
    for (const args of [['volume', 'ls', '--format', '{{.Name}}'], ['ps', '--all', '--format', '{{.Names}}']]) {
      if (read('docker', args).split('\n').some(name => name.endsWith(`_${project}`))) throw new Error('Generated project already has Docker resources; create refused.');
    }
    const directory = fs.mkdtempSync(path.join(path.dirname(source), 'chiroport-dev-'));
    fs.chmodSync(directory, 0o700);
    const workspace = path.join(directory, 'repo');
    const excluded = new Set(['.git', 'node_modules', '.next', '.vercel', '.temp', '.branches', '.npmrc', '.npm', '.cache', '.vscode', '.idea', 'tmp', '.Rapp.history', 'test-results', 'playwright-report', 'coverage', 'employees.json', 'employees.local.json']);
    fs.cpSync(source, workspace, { recursive: true, filter: file => { const name = path.basename(file); return !fs.lstatSync(file).isSymbolicLink() && !excluded.has(name) && !name.startsWith('.env') && !/^employees.*\.json$/.test(name) && !/\.(dump|log|tsbuildinfo|pem|zip|tgz|gz|bak)$/.test(name); } });
    const config = path.join(workspace, 'supabase/config.toml');
    if (!/^project_id\s*=/m.test(fs.readFileSync(config, 'utf8'))) throw new Error('Local project configuration missing; no Docker resources created.');
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace(/^project_id\s*=.*$/m, `project_id = "${project}"`));
    fs.writeFileSync(path.join(directory, manifestName), JSON.stringify({ workspace: fs.realpathSync(workspace), project, dockerHost, sourceRevision: read('git', ['rev-parse', 'HEAD']), seeded: false, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    console.log(`Editable source: ${workspace}\nOwned local project: ${project}\nRun there: node scripts/local-dev.cjs start`);
    return;
  }
  const ownership = owned();
  if (action === 'stop') {
    await command(ownership, 'supabase-stop', 'supabase', ['stop', '--project-id', ownership.state.project]);
    console.log('Owned synthetic volumes retained. Resume with start; do not use --no-backup or db:reset.');
    return;
  }
  if (action === 'start') {
    for (const port of [3000, 54321, 54322, 54323, 54324]) await freePort(port);
    if (!fs.existsSync(path.join(source, 'node_modules'))) await command(ownership, 'npm-ci', 'npm', ['ci']);
    await command(ownership, 'supabase-start', 'supabase', ['start']);
    localEnvironment(ownership);
    if (!ownership.state.seeded) {
      await command(ownership, 'synthetic-staff-seed', 'node', ['--env-file=.env.local', 'scripts/seed-local-demo.cjs']);
      ownership.state.seeded = true;
      fs.writeFileSync(ownership.manifest, JSON.stringify(ownership.state, null, 2), { mode: 0o600 });
    }
    console.log('Ready for separate terminals: node scripts/local-dev.cjs edge and node scripts/local-dev.cjs web\nSynthetic login: demo-staff@example.invalid / Synthetic-Only-2468!');
    return;
  }
  if (!ownership.state.seeded) throw new Error('Run start first; synthetic staff seed has not completed.');
  localEnvironment(ownership);
  if (action === 'web') {
    await freePort(3000);
    console.log('Editable app: http://127.0.0.1:3000');
    await command(ownership, 'next-dev', 'npm', ['run', 'dev', '--', '--hostname', '127.0.0.1'], true);
  } else {
    // The CLI supplies reserved SUPABASE_* values for its own local runtime;
    // the Edge env file contains only synthetic worker/CORS settings.
    await command(ownership, 'edge-dev', 'supabase', ['functions', 'serve', '--no-verify-jwt', '--env-file', '.env.edge.local'], true);
  }
}

main().catch(error => { console.error(error instanceof SyntaxError || error instanceof TypeError ? 'Local ownership/environment parsing failed; inspect private configuration without sharing values.' : error.message); process.exitCode = 1; });
