import { expect, test } from '@playwright/test';
import { expectNoAccessibilitySmokeIssues } from './accessibility.ts';
import { dismissStartupOverlays, forceEnglishLocale, useStableUiPreferences } from './helpers.ts';

test.describe('accessibility smoke coverage', () => {
  test.beforeEach(async ({ page }) => {
    await useStableUiPreferences(page);
    await forceEnglishLocale(page);
  });

  test('home shell and core dialogs expose accessible names and structure', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();
    await expectNoAccessibilitySmokeIssues(page, 'home shell');

    await page.getByRole('button', { name: 'Open Rules Brief' }).click();
    await expect(page.getByRole('dialog', { name: 'Rules Brief' })).toBeVisible();
    await expectNoAccessibilitySmokeIssues(page, 'rules brief dialog');

    await page.getByRole('button', { name: 'Back Home' }).first().click();
    await page.getByRole('button', { name: 'Player Guide' }).click();
    await expect(page.getByRole('dialog', { name: 'Player Guide' })).toBeVisible();
    await expectNoAccessibilitySmokeIssues(page, 'player guide dialog');
  });

  test('board tour and offline table retain accessible controls after navigation', async ({ page }) => {
    await page.goto('/board-tour');
    await expect(page.getByRole('heading', { level: 2, name: 'Board Map and Regions' })).toBeVisible();
    await expectNoAccessibilitySmokeIssues(page, 'board tour');

    await page.goto('/offline');
    await page.getByRole('button', { name: 'Start Session' }).click();
    await dismissStartupOverlays(page);
    await expect(page.getByRole('button', { name: 'Back Home' }).first()).toBeVisible();
    await expectNoAccessibilitySmokeIssues(page, 'offline table');
  });
});
