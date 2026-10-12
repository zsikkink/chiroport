import { test, expect, type Locator } from '@playwright/test';
import { createServiceClient, getTestEnv, randomPhone } from '../helpers/supabase';

test('ordinary staff can correct visits between all columns and use clear secondary dialog actions', async ({ page }) => {
  const env = getTestEnv();
  if (!env?.serviceKey || !['localhost', '127.0.0.1'].includes(new URL(env.url).hostname)) throw new Error('Dashboard corrections require local fixtures');
  if (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_API_KEY_SECRET) throw new Error('Synthetic corrections must not send provider messages');
  const service = createServiceClient(env);
  const email = `corrections-${crypto.randomUUID()}@example.invalid`;
  const password = 'Synthetic-Only-2468!';
  const name = 'Synthetic Dashboard Corrections';
  const phone = randomPhone();
  const user = await service.auth.admin.createUser({ email, password, email_confirm: true });
  expect(user.error).toBeNull();
  const userId = user.data.user!.id;
  let entryId: string | undefined;
  try {
    expect((await service.from('employee_profiles').insert({ user_id: userId, role: 'employee', is_open: true })).error).toBeNull();
    const joined = await service.rpc('join_queue_with_offering', { p_airport_code: 'MSP', p_location_code: 'concourse-c', p_full_name: name, p_phone_e164: phone, p_email: 'corrections@example.invalid', p_offering_code: 'chiropractic' });
    expect(joined.error).toBeNull();
    entryId = joined.data![0].out_queue_entry_id;
    expect((await service.rpc('staff_queue_entry_action', { p_entry_id: entryId, p_action: 'complete', p_actor_user_id: userId, p_target_location_id: null, p_departure_reason: null })).error).toBeNull();

    await page.goto('/employee/msp-concourse-c');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    const visitor = page.locator('[draggable="true"]').filter({ has: page.getByText(name, { exact: true }), hasText: phone });
    const waiting = page.getByRole('region', { name: 'Waiting', exact: true });
    const serving = page.getByRole('region', { name: 'Serving', exact: true });
    const history = page.getByRole('region', { name: 'History', exact: true });
    await expect(history.getByText(name, { exact: true })).toBeVisible();

    const actionResponse = () => page.waitForResponse(response =>
      response.url().includes('/functions/v1/queue_entry_action') &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.queueEntryId === entryId
    );
    const drag = async (target: Locator, status: string) => {
      const response = actionResponse();
      await visitor.dragTo(target);
      expect((await response).ok()).toBe(true);
      await expect(target.getByText(name, { exact: true })).toBeVisible();
      const entry = await service.from('queue_entries').select('status').eq('id', entryId!).single();
      expect(entry.data?.status).toBe(status);
    };
    await drag(serving, 'serving');
    const reopened = await service.from('queue_entries').select('completed_at,served_by_user_id').eq('id', entryId).single();
    expect(reopened.data).toEqual({ completed_at: null, served_by_user_id: userId });
    await drag(waiting, 'waiting');
    await visitor.dragTo(history);
    const completed = actionResponse();
    await page.getByRole('button', { name: 'Completed', exact: true }).click();
    expect((await completed).ok()).toBe(true);
    await expect(history.getByText(name, { exact: true })).toBeVisible();
    await drag(waiting, 'waiting');
    await drag(serving, 'serving');
    await visitor.dragTo(history);
    const cancelled = actionResponse();
    await page.getByRole('button', { name: 'Canceled', exact: true }).click();
    expect((await cancelled).ok()).toBe(true);
    await expect(history.getByText(name, { exact: true })).toBeVisible();

    await visitor.getByRole('button', { name: 'More actions', exact: true }).click();
    await visitor.getByRole('button', { name: 'Move', exact: true }).click();
    const moveDialog = page.getByRole('dialog', { name: 'Move customer', exact: true });
    await expect(moveDialog).toBeVisible();
    const cancel = moveDialog.getByRole('button', { name: 'Cancel', exact: true });
    expect(await cancel.evaluate(button => getComputedStyle(button).backgroundColor)).toBe('rgb(255, 255, 255)');
    const targetBounds = await moveDialog.getByLabel('Target location').boundingBox();
    const cancelBounds = await cancel.boundingBox();
    expect(cancelBounds!.y - (targetBounds!.y + targetBounds!.height)).toBeGreaterThan(20);
    await cancel.click();
    await expect(moveDialog).toHaveCount(0);

    await visitor.getByRole('button', { name: 'More actions', exact: true }).click();
    await visitor.getByRole('button', { name: 'Edit', exact: true }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit customer', exact: true });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByText('Update contact info and treatment selection.', { exact: true })).toHaveCount(0);
    expect(await editDialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(button => getComputedStyle(button).backgroundColor)).toBe('rgb(255, 255, 255)');
    await editDialog.getByRole('button', { name: 'Cancel', exact: true }).click();

    await drag(waiting, 'waiting');
    const message = 'Synthetic correction was rejected';
    await page.route('**/functions/v1/queue_entry_action', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({ status: 409, contentType: 'application/json', headers: { 'access-control-allow-origin': new URL(page.url()).origin }, body: JSON.stringify({ error: { code: 'invalid_transition', message } }) });
    });
    const reconciliation = page.waitForResponse(response => response.url().includes('/rest/v1/employee_queue_waiting_view'));
    await visitor.dragTo(serving);
    await reconciliation;
    await expect(waiting.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    expect((await service.from('queue_entries').select('status').eq('id', entryId).single()).data?.status).toBe('waiting');
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    if (entryId) await service.from('queue_entries').delete().eq('id', entryId);
    await service.from('customers').delete().eq('phone_e164', phone);
    await service.from('employee_profiles').delete().eq('user_id', userId);
    await service.auth.admin.deleteUser(userId);
  }
});
