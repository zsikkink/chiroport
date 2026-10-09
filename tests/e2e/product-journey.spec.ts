import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createServiceClient, getTestEnv, randomPhone } from '../helpers/supabase';

test.use({
  viewport: { width: 1440, height: 1000 },
  video: { mode: 'on', size: { width: 1440, height: 1000 } },
  launchOptions: { slowMo: process.env.CHIROPORT_CAPTURE_DEMO === '1' ? 250 : 0 },
});

test('synthetic visitor: browser intake → staff service → history → analytics', async ({ page }, testInfo) => {
  const env = getTestEnv();
  if (!env?.serviceKey || !['127.0.0.1', 'localhost'].includes(new URL(env.url).hostname)) throw new Error('Product journey requires isolated local Supabase');
  if (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_API_KEY_SECRET) throw new Error('Product journey must not have provider credentials');
  const service = createServiceClient(env);
  const { data: location } = await service.from('locations').select('id,display_name,timezone').eq('airport_code', 'HOU').eq('code', 'west-concourse').single();
  expect(location).toBeTruthy();
  const email = `demo-staff-${Date.now()}@example.invalid`;
  const password = 'Synthetic-Only-2468!';
  const phone = randomPhone();
  const name = 'Demo Visitor (Synthetic)';
  const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  expect(error).toBeNull();
  const userId = created.user!.id;
  expect((await service.from('employee_profiles').insert({ user_id: userId, role: 'admin', is_open: true })).error).toBeNull();
  let entryId: string | undefined;
  const shots = process.env.CHIROPORT_CAPTURE_DEMO === '1' ? path.resolve('docs/images') : testInfo.outputPath('screenshots');
  fs.mkdirSync(shots, { recursive: true });
  async function shot(target: Page, filename: string) {
    await target.screenshot({ path: path.join(shots, filename), fullPage: true });
  }
  try {
    // Prerequisite is an employee account, not an authenticated browser session.
    // Login, intake and all visit transitions use the actual user controls.
    const customer = page;
    await customer.goto('/locations/houston/west-concourse');
    await customer.getByRole('button', { name: 'No', exact: true }).first().click();
    await customer.getByLabel('Name', { exact: false }).fill(name);
    await customer.getByLabel('Phone Number', { exact: false }).fill(phone);
    await customer.getByLabel('Email Address', { exact: false }).fill('demo-visitor@example.invalid');
    await customer.getByRole('checkbox').focus();
    await customer.getByRole('checkbox').press('Space');
    await expect(customer.getByRole('checkbox')).toBeChecked();
    await shot(customer, 'synthetic-intake.png');
    const joined = customer.waitForResponse(response => response.url().includes('/functions/v1/queue_join') && response.request().method() === 'POST');
    await customer.getByRole('button', { name: 'Join Queue', exact: true }).click();
    const joinedResponse = await joined;
    expect(joinedResponse.ok()).toBeTruthy();
    entryId = (await joinedResponse.json()).queueEntryId;
    expect(entryId).toBeTruthy();
    await expect(customer.getByText(/You're in the queue/)).toBeVisible();
    await shot(customer, 'synthetic-joined.png');

    await page.goto('/employee/hou-west-concourse');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Employee Dashboard/ })).toBeVisible();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await shot(page, 'synthetic-queue.png');
    const serving = page.waitForResponse(response => response.url().includes('/functions/v1/queue_entry_action') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Move to serving', exact: true }).click();
    expect((await serving).ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Mark completed', exact: true })).toBeVisible();
    await shot(page, 'synthetic-serving.png');
    const completed = page.waitForResponse(response => response.url().includes('/functions/v1/queue_entry_action') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Mark completed', exact: true }).click();
    expect((await completed).ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Mark completed', exact: true })).toHaveCount(0);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText(/completed at /)).toBeVisible();
    await shot(page, 'synthetic-history.png');
    const entry = await service.from('queue_entries').select('status,created_at,served_at,completed_at,customer_id').eq('id', entryId!).single();
    expect(entry.data).toMatchObject({ status: 'completed', served_at: expect.any(String), completed_at: expect.any(String) });
    const events = await service.from('queue_events').select('event_type').eq('queue_entry_id', entryId!);
    expect(events.data!.map(event => event.event_type)).toEqual(expect.arrayContaining(['serving_by_staff', 'completed_by_staff']));
    const outbox = await service.from('sms_outbox').select('message_type,provider_message_id').eq('queue_entry_id', entryId!);
    expect(outbox.data!.filter(row => row.message_type === 'confirm')).toHaveLength(1);
    expect(outbox.data!.filter(row => row.message_type === 'serving')).toHaveLength(1);
    expect(outbox.data!.every(row => row.provider_message_id === null)).toBe(true);

    await page.goto('/employee/analytics');
    // Latest settled day is resolved by the database in the location calendar.
    // Relative presets currently use the browser calendar (documented separate
    // cross-timezone issue); do not make this journey depend on the runner TZ.
    const analytics = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/analytics' && url.searchParams.get('locationId') === location!.id && !url.searchParams.has('dateStart');
    });
    await page.getByLabel('Location scope').selectOption(location!.id);
    await expect(page.getByLabel('Time window')).toHaveValue('latest');
    const analyticsResponse = await analytics;
    expect(analyticsResponse.ok()).toBeTruthy();
    const payload = await analyticsResponse.json();
    expect(payload.analytics.kpis.completed_total).toBeGreaterThanOrEqual(1);
    const visitDay = new Intl.DateTimeFormat('en-CA', { timeZone: location!.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(entry.data!.created_at));
    expect(payload.analytics.filters.date_end).toBe(visitDay);
    await expect(page.getByText('Analytics Filters', { exact: true })).toBeVisible();
    await shot(page, 'synthetic-analytics.png');
  } finally {
    if (entryId) await service.from('queue_entries').delete().eq('id', entryId);
    await service.from('customers').delete().eq('phone_e164', phone);
    await service.from('employee_profiles').delete().eq('user_id', userId);
    await service.auth.admin.deleteUser(userId);
  }
});
