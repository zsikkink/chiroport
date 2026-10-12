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

  test('supports Space to open and Escape to close from inside the menu', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Join queue', exact: true });
    await trigger.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Select location' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Houston Airport' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Houston Airport' })).toHaveCount(0);

    await page.keyboard.press('Space');
    const airport = page.getByRole('button', { name: 'Minneapolis Airport' });
    await airport.click();
    await expect(airport).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('reveals locations without animation when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Join queue', exact: true });
    await trigger.click();
    const openTrigger = page.getByRole('button', { name: 'Select location' });
    await expect(openTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Houston Airport' })).toBeVisible();

    const transitions = await openTrigger.evaluate((button) => {
      const panel = document.getElementById(button.getAttribute('aria-controls')!);
      if (!panel) throw new Error('Location disclosure must reference its panel');
      return [button, button.parentElement!, panel, ...button.querySelectorAll('span, svg'),
        ...panel.querySelectorAll('button, span, svg, div')]
        .map((element) => {
          const style = getComputedStyle(element);
          return { property: style.transitionProperty, duration: style.transitionDuration };
        });
    });
    expect(transitions.every(({ property, duration }) =>
      property === 'none' || duration.split(',').every((value) => parseFloat(value) === 0)
    )).toBe(true);
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
