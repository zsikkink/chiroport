/** @jest-environment node */
import { checkRateLimit as checkServer } from '@/server/rateLimit';
import { loadEdge } from './helpers/edge-runtime.cjs';
const mockRpc = jest.fn();
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: () => ({ rpc: mockRpc }) }));

const privateValue = '+12025550123 alice@example.invalid 192.0.2.1 private-body secret-token';
const rules = [{ bucket: `phone:${privateValue}:day`, limit: 3, windowSeconds: 60 }];

describe('rate-limit logs', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.SUPABASE_SECRET_KEY = 'synthetic';
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { warn.mockRestore(); error.mockRestore(); });

  it.each(['blocked', 'error'])('preserves denial and useful metadata without identifiers on %s', async mode => {
    mockRpc.mockResolvedValue(mode === 'error' ? { error: { message: privateValue, details: privateValue } } : { data: [{ bucket_key: rules[0]!.bucket, allowed: false, limit_count: 3, remaining: 0, reset_at: new Date(Date.now() + 60000).toISOString() }], error: null });
    const { checkRateLimit: checkEdge } = loadEdge('_shared/rateLimit.ts');
    const edge = await checkEdge({ rpc: mockRpc }, rules, { endpoint: 'queue_join', failOpen: false, logContext: { phone: privateValue, anything: privateValue } });
    const server = await checkServer(rules, { failOpen: false, context: { anything: privateValue } });
    expect(edge.allowed).toBe(false);
    expect(server.allowed).toBe(false);
    const logs = JSON.stringify([warn.mock.calls, error.mock.calls]);
    for (const value of privateValue.split(' ')) expect(logs).not.toContain(value);
    expect(logs).toContain(mode === 'error' ? 'rate_limit_rpc_failed' : 'phone');
  });

  it('does not log an arbitrary exception and retains fail-closed behavior', async () => {
    mockRpc.mockRejectedValue(new Error(privateValue));
    expect(await checkServer(rules, { failOpen: false })).toMatchObject({ allowed: false });
    expect(JSON.stringify(error.mock.calls)).not.toContain(privateValue);
    expect(error).toHaveBeenCalledWith('[rate_limit] failed', { code: 'rate_limit_unavailable' });
  });
});
