import { expect, test } from '@playwright/test';
import { forceEnglishLocale } from './helpers.ts';

test.describe('home setup configuration', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('scenario, mode, and player-count controls update home setup state', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 2, name: 'Where the Stones Cry Out' })).toBeVisible();

    await page.getByRole('button', { name: 'Scenario' }).click();
    await page.getByRole('menuitem', { name: /2011 — TAHRIR SQUARE/i }).click();
    await expect(page.getByRole('heading', { level: 2, name: /TAHRIR SQUARE/i })).toBeVisible();

    const modeSelect = page.getByRole('combobox', { name: /Mode/i });
    await modeSelect.selectOption('SYMBOLIC');
    await expect(modeSelect).toHaveValue('SYMBOLIC');

    const playerCountSelect = page.getByRole('combobox', { name: /Player Count/i });
    await playerCountSelect.selectOption('2');
    await expect(playerCountSelect).toHaveValue('2');
    await expect(page.locator('article.seat-assembly-card')).toHaveCount(2);
  });
});
