const { test, expect } = require('@playwright/test');
const { TOTAL_ITEMS, answerAll, startQuiz } = require('./helpers');

test('renders exactly 4 radios per question, no neutral middle', async ({ page }) => {
  await startQuiz(page, '/scale4.html');
  await expect(page.locator('#items .scale4-item')).toHaveCount(TOTAL_ITEMS);
  await expect(page.locator('#items input[type="radio"]')).toHaveCount(TOTAL_ITEMS * 4);
  // First question's group has 4 options (even count => no neutral middle option).
  await expect(page.locator('#items .scale4-radios').first().locator('input')).toHaveCount(4);
});

test('selecting the strong-A radio stores 1.0; strong-B stores 2.0', async ({ page }) => {
  await startQuiz(page, '/scale4.html');
  const firstGroup = page.locator('#items .scale4-radios').first().locator('input');
  await firstGroup.nth(0).check();
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rms_answers_scale4'))['0_0']);
  expect(stored).toBeCloseTo(1.0, 3);
  await firstGroup.nth(3).check();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rms_answers_scale4'))['0_0']);
  expect(stored).toBeCloseTo(2.0, 3);
});

test('answering all enables results; total in [1,2]; radar renders', async ({ page }) => {
  await startQuiz(page, '/scale4.html');
  await answerAll(page, 'scale4');
  await page.locator('#showBtn').click();
  await expect(page.locator('#results')).toBeVisible();
  const total = parseFloat(await page.locator('#totalNum').textContent());
  expect(total).toBeGreaterThanOrEqual(1);
  expect(total).toBeLessThanOrEqual(2);
  await expect(page.locator('#radar')).toBeVisible();
});
