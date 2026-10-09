import { test, expect } from '@playwright/test';

test.describe('public location selector', () => {
  for (const viewport of [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ]) {
    test(`uses native responsive layout and keyboard disclosure at ${viewport.name} width`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const selector = page.getByRole('button', { name: 'Join queue' });
      await selector.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: 'Select location' })
      ).toHaveAttribute('aria-expanded', 'true');
      await expect(
        page.getByRole('button', { name: 'Houston Airport' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Atlanta Airport' })
      ).toHaveCount(0);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(hasHorizontalOverflow).toBe(false);

      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: 'Houston Airport' })
      ).toBeFocused();
    });
  }

  test('remains usable at 200 percent CSS zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.style.zoom = '200%';
    });
    await page.getByRole('button', { name: 'Join queue' }).click();

    await expect(
      page.getByRole('button', { name: 'Minneapolis Airport' })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      )
    ).toBe(false);
  });

  for (const route of [
    '/locations/dallas/concourse-a',
    '/locations/atlanta/concourse-a',
    '/locations/las-vegas/concourse-b',
  ]) {
    test(`shows a closure message without check-in at ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: 'This location is closed' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Join Queue', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'View open locations' })).toHaveAttribute('href', '/#locations');
    });
  }
});
