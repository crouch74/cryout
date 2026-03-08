import { expect, test } from '@playwright/test';
import { forceEnglishLocale, useStableUiPreferences } from './helpers.ts';

test.describe('visual regression baselines', () => {
  test.beforeEach(async ({ page }) => {
    await useStableUiPreferences(page);
    await forceEnglishLocale(page);
    await page.setViewportSize({ width: 1440, height: 960 });
  });

  test('home shell visual baseline remains stable', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('home-shell.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixels: 10,
    });
  });

  test('rules brief dialog visual baseline remains stable', async ({ page }) => {
    await page.goto('/guidelines');
    await expect(page.getByRole('dialog', { name: 'Rules Brief' })).toBeVisible();
    await expect(page).toHaveScreenshot('rules-brief-dialog.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('board tour visual baseline remains stable', async ({ page }) => {
    await page.goto('/board-tour');
    await expect(page.getByText('Guided Sequence')).toBeVisible();
    await expect(page).toHaveScreenshot('board-tour.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
