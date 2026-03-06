import { test } from '@playwright/test';
import { dismissStartupOverlays, forceEnglishLocale } from './helpers.ts';

test('debug offline table button names', async ({ page }) => {
  await forceEnglishLocale(page);
  await page.goto('/offline');
  console.log(`initial url: ${page.url()}`);
  await page.getByRole('button', { name: 'Start Session' }).click();
  console.log(`after start click: ${page.url()}`);
  await dismissStartupOverlays(page);
  console.log(`after dismiss overlays: ${page.url()}`);

  const buttonDetails = await page.locator('button').evaluateAll((buttons) => buttons.map((button) => {
    const accessibleNode = 'getComputedAccessibleNode' in window
      ? (window as Window & {
        getComputedAccessibleNode?: (element: Element) => { name?: string; role?: string } | undefined;
      }).getComputedAccessibleNode?.(button)
      : undefined;
    return {
      text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ariaLabel: button.getAttribute('aria-label'),
      title: button.getAttribute('title'),
      accessibleName: accessibleNode?.name ?? null,
      accessibleRole: accessibleNode?.role ?? null,
    };
  }));

  const roleButtonDetails = await page.locator('[role=\"button\"]').evaluateAll((buttons) => buttons.map((button) => {
    const accessibleNode = 'getComputedAccessibleNode' in window
      ? (window as Window & {
        getComputedAccessibleNode?: (element: Element) => { name?: string; role?: string } | undefined;
      }).getComputedAccessibleNode?.(button)
      : undefined;
    return {
      tagName: button.tagName,
      text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ariaLabel: button.getAttribute('aria-label'),
      title: button.getAttribute('title'),
      accessibleName: accessibleNode?.name ?? null,
      accessibleRole: accessibleNode?.role ?? null,
    };
  }));

  const pageSummary = await page.evaluate(() => ({
    pathname: window.location.pathname,
    hash: window.location.hash,
    bodySnippet: document.body.innerHTML.slice(0, 2000),
    buttonCount: document.querySelectorAll('button').length,
    roleButtonCount: document.querySelectorAll('[role="button"]').length,
  }));

  console.log(JSON.stringify(buttonDetails, null, 2));
  console.log(JSON.stringify(roleButtonDetails, null, 2));
  console.log(JSON.stringify(pageSummary, null, 2));
});
