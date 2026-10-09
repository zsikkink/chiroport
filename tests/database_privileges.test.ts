/** @jest-environment node */

import { execFileSync } from 'node:child_process';
import { createAnonClient, getTestEnv } from './helpers/supabase';

const env = getTestEnv();
const itIf = env?.serviceKey ? test : test.skip;

describe('effective database privilege contract', () => {
  itIf('matches the complete reviewed function allowlist and safe defaults', () => {
    expect(() => {
      execFileSync(process.execPath, ['scripts/check-database-privileges.cjs'], {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
      });
    }).not.toThrow();
  });

  itIf('denies anonymous execution of privileged security-definer commands', async () => {
    const anon = createAnonClient(env!);
    const attempts = await Promise.all([
      anon.rpc('staff_queue_entry_action', {
        p_entry_id: crypto.randomUUID(),
        p_action: 'complete',
        p_target_location_id: null,
        p_actor_user_id: null,
      }),
      anon.rpc('claim_sms_outbox', {
        p_limit: 1,
        p_lock_minutes: 5,
        p_message_id: null,
      }),
      anon.rpc('get_admin_analytics', {
        p_location_id: null,
        p_date_start: '2026-01-01',
        p_date_end: '2026-01-02',
        p_customer_type: null,
      }),
      anon.rpc('join_queue_with_offering', {
        p_airport_code: 'ATL',
        p_location_code: 'concourse-a',
        p_full_name: 'Bypass Attempt',
        p_phone_e164: '+15555550123',
        p_email: 'bypass@example.com',
        p_offering_code: 'chiropractic',
      }),
    ]);

    for (const attempt of attempts) {
      expect(attempt.error).toBeTruthy();
    }
  });
});
