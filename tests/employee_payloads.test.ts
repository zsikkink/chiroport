/** @jest-environment node */
import { loadEdge } from './helpers/edge-runtime.cjs';

const id = '00000000-0000-4000-8000-000000000001';
const endpoints = ['queue_entry_action', 'update_queue_entry', 'send_employee_message', 'advance_queue', 'set_serving'];

it.each(endpoints)('%s rejects malformed JSON and wrong field types before privileged I/O', async endpoint => {
  const requireEmployee = jest.fn();
  const service = { rpc: jest.fn(), from: jest.fn() };
  const { handler } = loadEdge(`${endpoint}/index.ts`, { service, overrides: { '../_shared/employeeAuth.ts': { requireEmployee } } });
  for (const body of ['null', '[]', 'false', '{', JSON.stringify({ queueEntryId: 12, queueId: 12 }), JSON.stringify({ queueEntryId: id, queueId: id, action: endpoint === 'queue_entry_action' ? 123 : 'serving', phone: 123, offeringCode: 123, body: { text: 'invalid' } })]) {
    // The last object's only valid fields belong to the compatibility endpoints.
    if (body.includes('invalid') && ['advance_queue', 'set_serving'].includes(endpoint)) continue;
    const response = await handler(new Request(`http://127.0.0.1/functions/v1/${endpoint}`, { method: 'POST', headers: { authorization: 'Bearer synthetic', 'content-type': 'application/json' }, body }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('validation_error');
  }
  expect(requireEmployee).not.toHaveBeenCalled();
  expect(service.rpc).not.toHaveBeenCalled();
  expect(service.from).not.toHaveBeenCalled();
});

it('acknowledges a committed join when metadata and immediate delivery are unavailable', async () => {
  const join = { out_queue_entry_id: id, out_public_token: id, out_queue_id: id, out_status: 'waiting', out_created_at: '2026-10-09T12:00:00Z', out_queue_position: 1 };
  const query = { select: () => query, eq: () => query, single: async () => ({ data: null, error: { code: 'synthetic_unavailable' } }) };
  const rpc = jest.fn(async () => ({ data: [join], error: null }));
  const delivery = jest.fn(async () => ({ status: 'retryable_failure' }));
  const { handler } = loadEdge('queue_join/index.ts', { service: { rpc, from: () => query }, console: { error() {}, warn() {} }, overrides: {
    '../_shared/rateLimit.ts': { checkRateLimit: async () => ({ allowed: true }), getRateLimitConfig: (_name: string, fallback: number) => fallback },
    '../_shared/outbox.ts': { sendOutboxForEntry: delivery, isSettledOutboxResult: () => false },
  } });
  const response = await handler(new Request('http://127.0.0.1/functions/v1/queue_join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ airportCode: 'HOU', locationCode: 'west-concourse', name: 'Synthetic Join', phone: '+12025550123', email: 'synthetic@example.invalid', consent: true, offeringCode: 'chiropractic' }) }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ queueEntryId: id, publicToken: id, status: 'waiting' });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(delivery).toHaveBeenCalledTimes(1);
});
