import assert from 'node:assert/strict';
import { test, expect, type Page } from '@playwright/test';
import { forceEnglishLocale } from './helpers.ts';

const SKINS = ['documentary-ink', 'nocturnal-dossier', 'civic-signal'] as const;

const HOME_LAYOUT_SELECTORS = [
  '.setup-feature-board',
  '.launch-surface',
  '.seat-assembly-surface',
];

async function captureLayoutBoxes(page: Page) {
  const entries = await Promise.all(HOME_LAYOUT_SELECTORS.map(async (selector) => {
    const locator = page.locator(selector).first();
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    assert.ok(box, `Missing bounding box for selector: ${selector}`);
    return [selector, box] as const;
  }));

  return new Map(entries);
}

test.describe('skin matrix visuals', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('captures shell and game screenshots for each skin with stable home layout', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    let baseline: Map<string, { x: number; y: number; width: number; height: number }> | null = null;

    for (const skin of SKINS) {
      await page.goto(`/?skin=${skin}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();

      const boxes = await captureLayoutBoxes(page);
      if (!baseline) {
        baseline = boxes;
      } else {
        for (const [selector, actual] of boxes) {
          const reference = baseline.get(selector);
          assert.ok(reference, `Missing baseline for ${selector}`);
          for (const key of ['x', 'y', 'width', 'height'] as const) {
            assert.ok(
              Math.abs(actual[key] - reference[key]) <= 1.5,
              `Layout drift for ${selector} (${key}) under ${skin}: ${actual[key]} vs ${reference[key]}`,
            );
          }
        }
      }

      await page.screenshot({ path: testInfo.outputPath(`${skin}-home.png`), fullPage: true });

      await page.getByRole('button', { name: 'Open Rules Brief' }).click();
      await expect(page.getByRole('dialog', { name: 'Rules Brief' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${skin}-rules-brief.png`), fullPage: true });
      await page.getByRole('button', { name: 'Back Home' }).first().click();
      await expect(page.getByRole('dialog', { name: 'Rules Brief' })).toHaveCount(0);

      await page.getByRole('button', { name: 'Player Guide' }).click();
      await expect(page.getByRole('dialog', { name: 'Player Guide' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${skin}-player-guide.png`), fullPage: true });
      await page.getByRole('button', { name: 'Back Home' }).first().click();
      await expect(page.getByRole('dialog', { name: 'Player Guide' })).toHaveCount(0);

      await page.getByRole('button', { name: 'Board Tour' }).click();
      await expect(page).toHaveURL(/\/board-tour/);
      await expect(page.getByText('Guided Sequence')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${skin}-board-tour.png`), fullPage: true });
      await page.goto(`/?skin=${skin}`);
      await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();

      await page.getByRole('button', { name: 'Room Play' }).click();
      await page.getByRole('button', { name: 'Start Session' }).click();
      await expect(page).toHaveURL(/\/rooms\//);
      await expect(page.locator('.room-lobby-board')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${skin}-room-lobby.png`), fullPage: true });

      await page.goto(`/?skin=${skin}`);
      await page.getByRole('button', { name: 'Local Table' }).click();
      await page.getByRole('button', { name: 'Start Session' }).click();
      await expect(page).toHaveURL(/\/offline/);
      await page.screenshot({ path: testInfo.outputPath(`${skin}-offline-board.png`), fullPage: true });
    }
  });
});
