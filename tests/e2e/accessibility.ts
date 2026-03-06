import { expect, type Page } from '@playwright/test';

interface AccessibilityIssue {
  selector: string;
  rule: string;
  detail: string;
}

function formatIssues(issues: AccessibilityIssue[]) {
  return issues.map((issue) => `${issue.rule} at ${issue.selector}: ${issue.detail}`).join('\n');
}

export async function expectNoAccessibilitySmokeIssues(page: Page, scopeLabel: string) {
  const issues = await page.evaluate(() => {
    type Issue = {
      selector: string;
      rule: string;
      detail: string;
    };

    const issues: Issue[] = [];

    const cssPath = (element: Element) => {
      const tag = element.tagName.toLowerCase();
      const id = element.getAttribute('id');
      if (id) {
        return `${tag}#${id}`;
      }

      const role = element.getAttribute('role');
      const classes = Array.from(element.classList).slice(0, 2).join('.');
      return `${tag}${role ? `[role="${role}"]` : ''}${classes ? `.${classes}` : ''}`;
    };

    const isHidden = (element: Element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
        return true;
      }
      const style = window.getComputedStyle(element);
      return style.display === 'none' || style.visibility === 'hidden';
    };

    const resolveName = (element: Element) => {
      const ariaLabel = element.getAttribute('aria-label')?.trim();
      if (ariaLabel) {
        return ariaLabel;
      }

      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const label = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim();
        if (label) {
          return label;
        }
      }

      if (element instanceof HTMLInputElement && element.labels?.length) {
        const labelText = Array.from(element.labels).map((label) => label.textContent?.trim() ?? '').join(' ').trim();
        if (labelText) {
          return labelText;
        }
      }

      const alt = element.getAttribute('alt')?.trim();
      if (alt) {
        return alt;
      }

      const title = element.getAttribute('title')?.trim();
      if (title) {
        return title;
      }

      return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    };

    const seenIds = new Set<string>();
    for (const element of Array.from(document.querySelectorAll('[id]'))) {
      const id = element.getAttribute('id');
      if (!id) {
        continue;
      }
      if (seenIds.has(id)) {
        issues.push({
          selector: cssPath(element),
          rule: 'duplicate-id',
          detail: `Duplicate id "${id}"`,
        });
      }
      seenIds.add(id);
    }

    for (const image of Array.from(document.querySelectorAll('img'))) {
      if (isHidden(image)) {
        continue;
      }
      if (!image.hasAttribute('alt')) {
        issues.push({
          selector: cssPath(image),
          rule: 'image-alt',
          detail: 'Visible image is missing an alt attribute.',
        });
      }
    }

    for (const control of Array.from(document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="textbox"], [role="combobox"]'))) {
      if (isHidden(control)) {
        continue;
      }

      const name = resolveName(control);
      if (!name) {
        issues.push({
          selector: cssPath(control),
          rule: 'control-name',
          detail: 'Interactive control is missing an accessible name.',
        });
      }
    }

    for (const field of Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'))) {
      if (isHidden(field) || !(field instanceof HTMLElement)) {
        continue;
      }

      const name = resolveName(field);
      if (!name) {
        issues.push({
          selector: cssPath(field),
          rule: 'form-label',
          detail: 'Form control is missing a label or aria-label.',
        });
      }
    }

    for (const dialog of Array.from(document.querySelectorAll('dialog, [role="dialog"]'))) {
      if (isHidden(dialog)) {
        continue;
      }

      const name = resolveName(dialog);
      if (!name) {
        issues.push({
          selector: cssPath(dialog),
          rule: 'dialog-name',
          detail: 'Dialog is missing an accessible name.',
        });
      }
    }

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter((heading) => !isHidden(heading))
      .map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        selector: cssPath(heading),
      }));

    for (let index = 1; index < headings.length; index += 1) {
      const previous = headings[index - 1];
      const current = headings[index];
      if (current.level - previous.level > 1) {
        issues.push({
          selector: current.selector,
          rule: 'heading-order',
          detail: `Heading level jumps from h${previous.level} to h${current.level}.`,
        });
      }
    }

    return issues;
  });

  expect(issues, `${scopeLabel} accessibility smoke issues:\n${formatIssues(issues)}`).toEqual([]);
}
