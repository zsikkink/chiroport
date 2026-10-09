/** @jest-environment node */

import { createServiceClient, getTestEnv } from './helpers/supabase';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const env = getTestEnv();
const itIf = env?.serviceKey ? test : test.skip;

describe('scheduled database jobs', () => {
  itIf('conserves fixture totals and weighted means across rollup, replay, and rebuild', () => {
    const url = new URL(process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Synthetic rollup fixture requires local PostgreSQL');
    expect(() => execFileSync('psql', [url.toString(), '-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, 'fixtures/rollup-conservation.sql')], { stdio: ['ignore', 'pipe', 'pipe'] })).not.toThrow();
  });
  itIf('can execute both monthly rollup paths', async () => {
    const service = createServiceClient(env!);
    const today = new Date().toISOString().slice(0, 10);

    const rebuild = await service.rpc('rebuild_queue_monthly_stats', {
      p_start: today,
      p_end: today,
    });
    expect(rebuild.error).toBeNull();

    const rollup = await service.rpc('rollup_queue_monthly_stats');
    expect(rollup.error).toBeNull();
  });
});
