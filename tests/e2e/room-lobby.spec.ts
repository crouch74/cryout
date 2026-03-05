import { expect, test } from '@playwright/test';
import { forceEnglishLocale } from './helpers.ts';

test.describe('room lobby multiplayer flow', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('host creates room, second player claims slot, host launches match', async ({ page, browser }) => {
    await page.goto('/');

    const playerCountSelect = page.getByRole('combobox', { name: /Player Count/i });
    await playerCountSelect.selectOption('2');
    await expect(playerCountSelect).toHaveValue('2');

    const roomPlayButton = page.getByRole('button', { name: 'Room Play' });
    await expect(roomPlayButton).toBeEnabled({ timeout: 15_000 });
    await roomPlayButton.click();

    await page.getByRole('button', { name: 'Start Session' }).click();

    await expect(page).toHaveURL(/\/rooms\/[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
    await expect(page.getByText('Room Lobby')).toBeVisible();

    const startRoomMatch = page.getByRole('button', { name: 'Start Room Match' });
    await expect(startRoomMatch).toBeDisabled();

    const roomUrl = page.url();
    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await forceEnglishLocale(secondPage);
    await secondPage.goto(roomUrl);

    await expect(secondPage.getByText('Room Lobby')).toBeVisible();
    await secondPage.getByRole('button', { name: 'Claim This Slot' }).first().click();
    await expect(secondPage.getByText('You')).toBeVisible();

    await expect(startRoomMatch).toBeEnabled({ timeout: 10_000 });
    await startRoomMatch.click();

    await expect(page.getByRole('button', { name: 'Back Home' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(secondPage.getByRole('button', { name: 'Back Home' }).first()).toBeVisible({ timeout: 15_000 });

    await secondContext.close();
  });
});
