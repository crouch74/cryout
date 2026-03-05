import { expect, test } from '@playwright/test';
import { forceEnglishLocale } from './helpers.ts';

test.describe('shell navigation', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('home utilities open and close shell guide dialogs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();

    await page.getByRole('button', { name: 'Open Rules Brief' }).click();
    await expect(page.getByRole('dialog', { name: 'Rules Brief' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open Table/i })).toBeVisible();
    await page.getByRole('button', { name: 'Back Home' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Rules Brief' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Player Guide' }).click();
    await expect(page.getByRole('dialog', { name: 'Player Guide' })).toBeVisible();
    await expect(page.getByText('Round Loop')).toBeVisible();
    await page.getByRole('button', { name: 'Back Home' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Player Guide' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Board Tour' }).click();
    await expect(page).toHaveURL(/\/board-tour$/);
    await expect(page.getByText('Read the table before it breaks')).toBeVisible();
    await expect(page.getByText('Guided Sequence')).toBeVisible();
    await page.getByRole('button', { name: 'Back Home' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();
  });
});
