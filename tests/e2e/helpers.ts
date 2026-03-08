import type { Page } from '@playwright/test';

export async function forceLocale(page: Page, locale: string) {
  await page.addInitScript((nextLocale) => {
    window.localStorage.setItem('stones-cutover-locale', nextLocale);
  }, locale);
}

export async function forceEnglishLocale(page: Page) {
  await forceLocale(page, 'en');
}

export async function useStableUiPreferences(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.localStorage.setItem('stones-tabletop-motion', 'reduced');
    window.localStorage.setItem('stones-tabletop-contrast', 'default');
    window.localStorage.setItem('stones.ui.skin', 'civic-signal');
  });
}

export async function dismissStartupOverlays(page: Page) {
  const overlayAdvanceButtons = [
    page.getByRole('button', { name: 'Begin the Struggle' }),
    page.getByRole('button', { name: 'Enter the Table' }),
    page.getByRole('button', { name: 'Continue' }),
    page.getByRole('button', { name: 'Confirm' }),
    page.getByRole('button', { name: 'Resolve' }),
  ];
  const playSystemButton = page.getByRole('button', { name: 'Play System' });
  const gameplayControlsButton = page.getByRole('button', { name: 'Gameplay display controls' });
  const ledgerButton = page.getByRole('button', { name: 'Ledger' });
  const blockingStartupOverlays = [
    page.locator('.deck-reveal-overlay'),
    page.locator('.campaign-result-shell'),
  ];

  const deadline = Date.now() + 15_000;
  let settledCycles = 0;
  while (Date.now() < deadline) {
    if (page.isClosed()) {
      return;
    }

    let handledOverlay = false;

    for (const button of overlayAdvanceButtons) {
      if (!(await button.isVisible({ timeout: 1_500 }).catch(() => false))) {
        continue;
      }

      await button.scrollIntoViewIfNeeded().catch(() => undefined);
      await button.click({ timeout: 5_000, force: true });
      await button.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
      handledOverlay = true;
      break;
    }

    if (handledOverlay) {
      settledCycles = 0;
      continue;
    }

    let blockingOverlayVisible = false;
    for (const overlay of blockingStartupOverlays) {
      if (await overlay.isVisible({ timeout: 250 }).catch(() => false)) {
        blockingOverlayVisible = true;
        break;
      }
    }

    if (blockingOverlayVisible) {
      settledCycles = 0;
      await page.waitForTimeout(250);
      continue;
    }

    if (
      await gameplayControlsButton.isVisible({ timeout: 250 }).catch(() => false)
      && await ledgerButton.first().isVisible({ timeout: 250 }).catch(() => false)
      && await playSystemButton.isVisible({ timeout: 250 }).catch(() => false)
      && await playSystemButton.isEnabled({ timeout: 250 }).catch(() => false)
      && !blockingOverlayVisible
    ) {
      settledCycles += 1;
      if (settledCycles >= 10) {
        return;
      }
    } else {
      settledCycles = 0;
    }

    await page.waitForTimeout(250).catch(() => undefined);
  }

  await page.getByRole('button', { name: 'Begin the Struggle' }).waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Enter the Table' }).waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Continue' }).waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Confirm' }).waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Resolve' }).waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
}

export async function settleLateStartupPrompts(page: Page) {
  const lateButtons = ['Confirm', 'Continue', 'Enter the Table', 'Begin the Struggle', 'Resolve'];
  for (let cycle = 0; cycle < 8; cycle += 1) {
    let handled = false;
    for (const label of lateButtons) {
      const button = page.getByRole('button', { name: label });
      if (!(await button.isVisible().catch(() => false))) {
        continue;
      }
      await button.click({ force: true });
      await button.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
      handled = true;
      break;
    }
    if (!handled) {
      return;
    }
    await page.waitForTimeout(250);
  }
}
