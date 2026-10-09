import { test, expect } from '@playwright/test';
import { createServiceClient, getTestEnv, randomPhone } from '../helpers/supabase';
import { toLocationSlug } from '../../src/lib/locationSlug';

for (const pending of ['action', 'realtime']) {
  test(`route A → B → A isolates a delayed ${pending} completion`, async ({ page }) => {
    const env = getTestEnv();
    if (!env?.serviceKey || !['localhost', '127.0.0.1'].includes(new URL(env.url).hostname)) throw new Error('Local fixtures required');
    const service = createServiceClient(env);
    const { data: locations } = await service.from('locations').select('id,airport_code,code,display_name').eq('is_open', true).order('airport_code').limit(2);
    const [a, b] = locations!;
    const email = `context-${Date.now()}@example.invalid`, password = 'Synthetic-Only-2468!';
    const { data: user } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    await service.from('employee_profiles').insert({ user_id: user.user!.id, role: 'admin', is_open: true });
    const phone = randomPhone();
    const { data: joined } = await service.rpc('join_queue_with_offering', { p_airport_code: a!.airport_code, p_location_code: a!.code, p_full_name: 'Synthetic Context A', p_phone_e164: phone, p_email: 'context@example.invalid', p_offering_code: 'chiropractic' });
    const entryId = joined![0].out_queue_entry_id;
    let release!: () => void, observed!: () => void;
    const held = new Promise<void>(resolve => { observed = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    try {
      await page.goto(`/employee/${toLocationSlug(a!.airport_code, a!.code)}`);
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      await expect(page.getByText('Synthetic Context A', { exact: true })).toBeVisible();
      if (pending === 'action') {
        await page.route('**/functions/v1/queue_entry_action', async route => {
          if (route.request().method() !== 'POST') return route.continue();
          observed(); await gate;
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'synthetic_failure', message: 'Delayed failure from old A' } }) });
        });
        await page.getByRole('button', { name: 'Move to serving', exact: true }).click();
      } else {
        await page.route('**/rest/v1/employee_queue_serving_view?**', async route => {
          if (!decodeURIComponent(route.request().url()).includes(`queue_entry_id=eq.${entryId}`)) return route.continue();
          const response = await route.fetch(); observed(); await gate;
          await route.fulfill({ response });
        });
        expect((await service.rpc('staff_queue_entry_action', { p_entry_id: entryId, p_action: 'serving', p_actor_user_id: user.user!.id })).error).toBeNull();
      }
      await Promise.race([held, new Promise((_, reject) => setTimeout(() => reject(new Error('Expected delayed boundary was not reached')), 8000))]);
      // Client navigation matters: page.goto would reload and conceal a missing key.
      for (const location of [b!, a!]) {
        await page.getByRole('button', { name: 'Open locations menu' }).focus();
        await page.getByRole('button', { name: location.display_name, exact: true }).click();
        await expect(page.getByRole('heading', { name: `Employee Dashboard · ${location.display_name}`, exact: true })).toBeVisible();
        if (pending === 'realtime' && location.id === b!.id) {
          expect((await service.rpc('staff_queue_entry_action', { p_entry_id: entryId, p_action: 'complete', p_actor_user_id: user.user!.id })).error).toBeNull();
        }
      }
      if (pending === 'action') await expect(page.getByRole('button', { name: 'Move to serving', exact: true })).toBeEnabled();
      else {
        await expect(page.getByText(/completed at /)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Mark completed', exact: true })).toHaveCount(0);
      }
      const delayed = page.waitForResponse(response => pending === 'action' ? response.url().includes('/functions/v1/queue_entry_action') : decodeURIComponent(response.url()).includes(`queue_entry_id=eq.${entryId}`));
      release();
      await (await delayed).finished();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(page.getByText('Delayed failure from old A', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Synthetic Context A', { exact: true })).toHaveCount(1);
      if (pending === 'realtime') await expect(page.getByRole('button', { name: 'Mark completed', exact: true })).toHaveCount(0);
    } finally {
      release();
      await page.unrouteAll({ behavior: 'wait' });
      await service.from('queue_entries').delete().eq('id', entryId);
      await service.from('customers').delete().eq('phone_e164', phone);
      await service.from('employee_profiles').delete().eq('user_id', user.user!.id);
      await service.auth.admin.deleteUser(user.user!.id);
    }
  });
}
