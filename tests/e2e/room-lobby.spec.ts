import { expect, test } from '@playwright/test';
import { dismissStartupOverlays, forceEnglishLocale, useStableUiPreferences } from './helpers.ts';

const ROOM_SERVICE_URL = 'http://127.0.0.1:3010';

const ROOM_CONFIG = {
  rulesetId: 'stones_cry_out',
  mode: 'LIBERATION',
  humanPlayerCount: 2,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 0, 1, 1],
  seed: 7070,
  secretMandates: 'enabled',
} as const;

test.describe('room lobby multiplayer flow', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
    await useStableUiPreferences(page);
  });

  test('host creates room, second player claims slot, host launches match', async ({ page, browser, request }) => {
    const createResponse = await request.post(`${ROOM_SERVICE_URL}/api/rooms`, {
      data: ROOM_CONFIG,
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = await createResponse.json();
    const roomId = created.roomId as string;
    const roomUrl = `/rooms/${roomId}`;

    await page.addInitScript(({ targetRoomId, credential }) => {
      window.localStorage.setItem(`stones-room-credential:${targetRoomId}`, JSON.stringify(credential));
    }, { targetRoomId: roomId, credential: created.hostCredential });
    await page.goto(roomUrl);
    await expect(page.getByText('Room Lobby')).toBeVisible();

    const startRoomMatch = page.getByRole('button', { name: 'Start Room Match' });
    await expect(startRoomMatch).toBeDisabled();

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await forceEnglishLocale(secondPage);
    await useStableUiPreferences(secondPage);
    await secondPage.goto(page.url());

    await expect(secondPage.getByText('Room Lobby')).toBeVisible();
    await secondPage.getByRole('button', { name: 'Claim This Slot' }).first().click();
    await expect(secondPage.getByText('You')).toBeVisible();

    await expect(startRoomMatch).toBeEnabled({ timeout: 10_000 });
    await startRoomMatch.click();

    await dismissStartupOverlays(page);
    await dismissStartupOverlays(secondPage);
    await expect(page.getByRole('button', { name: 'Gameplay display controls' })).toBeVisible({ timeout: 15_000 });
    await expect(secondPage.getByRole('button', { name: 'Gameplay display controls' })).toBeVisible({ timeout: 15_000 });

    await secondContext.close();
  });
});
