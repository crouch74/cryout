import { expect, test } from '@playwright/test';
import { forceEnglishLocale } from './helpers.ts';

test.describe('board tour flow', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('guided sequence navigates step boundaries and can open offline table', async ({ page }) => {
    await page.goto('/board-tour');

    await expect(page.getByText('Guided Sequence')).toBeVisible();
    await expect(page.getByText('1 / 11')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Board Map and Regions' })).toBeVisible();

    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.getByText('1 / 11')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('2 / 11')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Extraction Tokens' })).toBeVisible();

    for (let step = 0; step < 20; step += 1) {
      await page.getByRole('button', { name: 'Next' }).click();
    }

    await expect(page.getByText('11 / 11')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Terminal Warning Patterns' })).toBeVisible();

    await page.getByRole('button', { name: /Open Table/i }).first().click();
    await expect(page).toHaveURL(/\/offline$/);
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();
  });
});
