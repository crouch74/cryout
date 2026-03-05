import type { Page } from '@playwright/test';

export async function forceEnglishLocale(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('stones-cutover-locale', 'en');
  });
}

export async function dismissStartupOverlays(page: Page) {
  const beginButton = page.getByRole('button', { name: 'Begin the Struggle' });
  if (await beginButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await beginButton.click();
  }

  const continueButton = page.getByRole('button', { name: 'Continue' });
  for (let index = 0; index < 4; index += 1) {
    if (!(await continueButton.isVisible({ timeout: 1_500 }).catch(() => false))) {
      break;
    }
    await continueButton.click();
  }
}
