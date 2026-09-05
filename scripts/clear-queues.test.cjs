const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'clear-queues.cjs'), 'utf8');
const id = '00000000-0000-4000-8000-000000000001';

async function run(args, url = 'https://example.supabase.co') {
  const writes = [];
  let clients = 0, exit = 0;
  const client = { from: table => {
    let deleting = false;
    const q = {
      select: () => q,
      delete: () => { deleting = true; return q; },
      eq: (key, value) => { if (deleting) writes.push({ table, key, value }); return q; },
      neq: (key, value) => { if (deleting) writes.push({ table, key, value }); return q; },
      maybeSingle: async () => ({ data: { id }, error: null }),
      then: resolve => resolve({ error: null, count: 2 }),
    };
    return q;
  } };
  try {
    vm.runInNewContext(source, {
      require: name => name === 'fs' ? { existsSync: () => false } : name === 'path' ? path : { createClient: () => { clients++; return client; } },
      URL, console: { error() {}, log() {} },
      process: { argv: ['node', 'clear-queues.cjs', ...args], cwd: () => __dirname, env: { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: 'synthetic' }, exit: code => { exit = code; throw new Error('refused'); } },
    });
  } catch (error) { if (error.message !== 'refused') throw error; }
  await new Promise(resolve => setImmediate(resolve));
  return { writes, clients, exit };
}

for (const selector of [['--all'], ['--queue-id', id], ['--airport-code', 'ATL', '--location-code', 'concourse-a']]) {
  test(`all delete paths require confirmation: ${selector[0]}`, async () => {
    assert.deepEqual(await run(selector), { writes: [], clients: 0, exit: 1 });
  });
  for (const url of ['https://example.supabase.co', 'https://localhost.attacker.invalid', 'https://custom.invalid/?host=localhost']) {
    test(`remote override required: ${selector[0]} ${url}`, async () => {
      assert.deepEqual(await run([...selector, '--confirm'], url), { writes: [], clients: 0, exit: 1 });
    });
  }
  test(`dry-run never writes: ${selector[0]}`, async () => {
    assert.equal((await run([...selector, '--dry-run'])).writes.length, 0);
  });
  test(`confirmed local selector has one scoped delete: ${selector[0]}`, async () => {
    const result = await run([...selector, '--confirm'], 'http://127.0.0.1:54321');
    assert.equal(result.exit, 0);
    assert.equal(result.writes.length, 1);
    assert.equal(result.writes[0].table, 'queue_entries');
    assert.equal(result.writes[0].key, selector[0] === '--all' ? 'id' : 'queue_id');
    if (selector[0] !== '--all') assert.equal(result.writes[0].value, id);
  });
}
test('explicit remote override permits only its resolved queue', async () => {
  assert.equal((await run(['--queue-id', id, '--confirm', '--force-prod'])).writes[0].value, id);
});
for (const args of [['--all', '--queue-id', id], ['--all', '--queue-id'], ['--all', '--all'], ['--queue-id', id, '--queue-id', id], ['--all', 'orphan'], ['--queue-id', 'bad'], ['--all', '--unexpected'], ['--airport-code', 'ATL']]) {
  test(`invalid selection is refused: ${args.join(' ')}`, async () => {
    assert.deepEqual(await run([...args, '--confirm', '--force-prod']), { writes: [], clients: 0, exit: 1 });
  });
}
for (const url of ['not-a-url', 'file:///tmp/data', 'https://user:password@example.invalid']) {
  test(`invalid target refused: ${url.split(':')[0]}`, async () => {
    assert.deepEqual(await run(['--all', '--confirm', '--force-prod'], url), { writes: [], clients: 0, exit: 1 });
  });
}
