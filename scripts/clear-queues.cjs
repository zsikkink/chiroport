#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  contents.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile(path.join(process.cwd(), '.env.local'));

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : null;
};

const all = flags.has('--all');
const confirm = flags.has('--confirm');
const forceProd = flags.has('--force-prod');
const dryRun = flags.has('--dry-run');
const queueId = getArgValue('--queue-id') || getArgValue('--queue');
const airportCode = getArgValue('--airport-code');
const locationCode = getArgValue('--location-code');

if (!all && !queueId && !(airportCode && locationCode)) {
  console.error(
    'Usage:\n' +
      '  npm run queue:clear -- --all\n' +
      '  npm run queue:clear -- --all --confirm [--force-prod]\n' +
      '  npm run queue:clear -- --queue-id <uuid>\n' +
      '  npm run queue:clear -- --airport-code <code> --location-code <slug>\n' +
      'Options:\n' +
      '  --confirm     Required for every delete\n' +
      '  --force-prod  Required for every non-loopback delete\n' +
      '  --dry-run     Print what would be deleted and exit\n'
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.');
  process.exit(1);
}

// Resolve the target before creating a privileged client. A location selector
// is just as destructive as --all; unknown/custom hosts are remote, not safe.
let target;
try {
  target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error();
} catch {
  console.error('Refusing invalid Supabase URL.');
  process.exit(1);
}
const allowedFlags = new Set(['--all', '--confirm', '--force-prod', '--dry-run', '--queue-id', '--queue', '--airport-code', '--location-code']);
const valueFlags = new Set(['--queue-id', '--queue', '--airport-code', '--location-code']);
const invalidArguments = args.filter(arg => arg.startsWith('--')).length !== flags.size || args.some((arg, index) =>
  arg.startsWith('--')
    ? !allowedFlags.has(arg) || (valueFlags.has(arg) && (!args[index + 1] || args[index + 1].startsWith('--')))
    : index === 0 || !valueFlags.has(args[index - 1])
);
const selectors = Number(all) + Number(Boolean(queueId)) + Number(Boolean(airportCode || locationCode));
if (invalidArguments || selectors !== 1 || (Boolean(airportCode) !== Boolean(locationCode)) ||
    (flags.has('--queue') && flags.has('--queue-id')) ||
    [...flags].some(flag => !allowedFlags.has(flag)) ||
    (queueId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queueId))) {
  console.error('Refusing invalid or ambiguous queue selector.');
  process.exit(1);
}
if (!dryRun && !confirm) {
  console.error('Refusing delete without --confirm. Use --dry-run to inspect the target.');
  process.exit(1);
}
if (!dryRun && !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) && !forceProd) {
  console.error('Refusing remote delete without --force-prod.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function countQueueEntries(filter) {
  const query = supabase.from('queue_entries').select('id', { count: 'exact', head: true });
  filter(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function resolveQueueId() {
  if (queueId) return queueId;
  if (airportCode && locationCode) {
    const { data: locationRow, error: locationError } = await supabase
      .from('locations')
      .select('id')
      .eq('airport_code', airportCode)
      .eq('code', locationCode)
      .maybeSingle();

    if (locationError || !locationRow) {
      throw new Error('Location not found.');
    }

    const { data: queueRow, error: queueError } = await supabase
      .from('queues')
      .select('id')
      .eq('location_id', locationRow.id)
      .eq('code', 'default')
      .maybeSingle();

    if (queueError || !queueRow) {
      throw new Error('Queue not found for location.');
    }

    return queueRow.id;
  }
  return null;
}

async function clearQueues() {
  if (all) {
    if (dryRun) {
      if (process.env.CLEAR_QUEUE_SKIP_COUNT !== '1') {
        const count = await countQueueEntries((q) => q.neq('id', '00000000-0000-0000-0000-000000000000'));
        console.log(`[dry-run] Would delete ${count} queue entries from ${url}.`);
      } else {
        console.log('[dry-run] Count skipped.');
      }
      return;
    }

    const { error } = await supabase
      .from('queue_entries')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
    console.log('Cleared all queue entries.');
    return;
  }

  const resolvedQueueId = await resolveQueueId();
  if (!resolvedQueueId) {
    throw new Error('Queue ID could not be resolved.');
  }

  if (dryRun) {
    const count = await countQueueEntries((q) => q.eq('queue_id', resolvedQueueId));
    console.log(`[dry-run] Would delete ${count} queue entries from ${url} for queue ${resolvedQueueId}.`);
    return;
  }

  const { error } = await supabase
    .from('queue_entries')
    .delete({ count: 'exact' })
    .eq('queue_id', resolvedQueueId);

  if (error) throw error;
  console.log(`Cleared queue entries for queue ${resolvedQueueId}.`);
}

clearQueues().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Failed to clear queues.');
  process.exit(1);
});
