/** @jest-environment node */

import { createServiceClient, getTestEnv } from './helpers/supabase';

const env = getTestEnv();
const itIf = env?.serviceKey ? test : test.skip;

describe('scheduled database jobs', () => {
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
