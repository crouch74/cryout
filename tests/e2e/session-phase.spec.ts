import { expect, test } from '@playwright/test';
import { dismissStartupOverlays, forceEnglishLocale, settleLateStartupPrompts, useStableUiPreferences } from './helpers.ts';

test.describe('session phase progression', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await useStableUiPreferences(page);
    await forceEnglishLocale(page);
  });

  test('local session can advance from system phase to coalition planning', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Session' }).click();
    await dismissStartupOverlays(page);
    await settleLateStartupPrompts(page);
    await dismissStartupOverlays(page);

    const playSystem = page.getByRole('button', { name: 'Play System' });
    await expect(playSystem).toBeVisible();
    await expect(playSystem).toBeEnabled();
    await playSystem.click();

    await expect(playSystem).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Commit Prepared Moves' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Organize(?:\s+Organize)?$/ })).toBeVisible();
  });
});
