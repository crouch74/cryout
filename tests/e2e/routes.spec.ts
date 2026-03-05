import { expect, test } from '@playwright/test';
import { forceEnglishLocale } from './helpers.ts';

test.describe('route entry points', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('supports direct guidelines and player-guide routes', async ({ page }) => {
    await page.goto('/guidelines');
    await expect(page.getByRole('dialog', { name: 'Rules Brief' })).toBeVisible();
    await expect(page.getByText('Defeat Checks')).toBeVisible();

    await page.goto('/player-guide');
    await expect(page.getByRole('dialog', { name: 'Player Guide' })).toBeVisible();
    await expect(page.getByText('Coordination with Tension')).toBeVisible();
  });

  test('offline route keeps offline-safe rules brief action', async ({ page }) => {
    await page.goto('/offline');

    await expect(page.getByRole('button', { name: 'Rules Brief' })).toBeVisible();
    await page.getByRole('button', { name: 'Rules Brief' }).click();
    await expect(page.getByRole('dialog', { name: 'Rules Brief' })).toBeVisible();
    await page.getByRole('button', { name: 'Back Home' }).first().click();
    await expect(page.getByRole('button', { name: 'Rules Brief' })).toBeVisible();
  });

  test('unknown route still renders the home shell safely', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();
  });

  test('missing room permalink without credentials returns to home shell', async ({ page }) => {
    await page.goto('/rooms/not-found-room');
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();
  });
});
