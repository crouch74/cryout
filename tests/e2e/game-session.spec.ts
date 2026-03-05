import { expect, test } from '@playwright/test';
import { dismissStartupOverlays, forceEnglishLocale } from './helpers.ts';

test.describe('local table session flow', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('starts a local session and returns back home', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Start Session' }).click();
    await dismissStartupOverlays(page);

    await expect(page.getByRole('button', { name: 'Back Home' }).first()).toBeVisible();
    await expect(page.getByText('Round')).toBeVisible();

    await page.getByRole('button', { name: 'Back Home' }).first().click();
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();
  });
});
