const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { startQuiz } = require('./helpers');

for (const [name, path] of [['binary', '/index.html'], ['scale4', '/scale4.html'], ['landing', '/versions.html']]) {
  test(`${name} intro has no serious/critical a11y violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(v => ['serious', 'critical'].includes(v.impact));
    expect(serious, JSON.stringify(serious.map(v => v.id), null, 2)).toEqual([]);
  });
}

for (const [name, path] of [['binary', '/index.html'], ['scale4', '/scale4.html']]) {
  test(`${name} quiz form has no serious/critical a11y violations`, async ({ page }) => {
    await startQuiz(page, path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(v => ['serious', 'critical'].includes(v.impact));
    expect(serious, JSON.stringify(serious.map(v => v.id), null, 2)).toEqual([]);
  });
}
