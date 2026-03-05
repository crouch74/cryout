import { expect, test } from '@playwright/test';
import { dismissStartupOverlays, forceEnglishLocale } from './helpers.ts';

test.describe('session phase progression', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('local session can advance from system phase to coalition planning', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Session' }).click();
    await dismissStartupOverlays(page);

    const playSystem = page.getByRole('button', { name: 'Play System' });
    await expect(playSystem).toBeVisible();
    await playSystem.click();

    await expect(playSystem).toHaveCount(0);
    await expect(page.getByText('Prepare moves, then mark every seat ready.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prepare Move' }).first()).toBeVisible();
  });
});
