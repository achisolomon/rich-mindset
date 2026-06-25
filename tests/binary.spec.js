const { test, expect } = require('@playwright/test');
const { TOTAL_ITEMS, answerAll, startQuiz } = require('./helpers');

test('intro shows then start reveals all questions as 2-button rows', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#intro')).toBeVisible();
  await expect(page.locator('#quiz')).toBeHidden();

  await page.getByRole('button', { name: /נתחיל/ }).click();
  await expect(page.locator('#quiz')).toBeVisible();

  // Each question renders exactly two statement buttons.
  await expect(page.locator('#items .item')).toHaveCount(TOTAL_ITEMS);
  await expect(page.locator('#items .stmt')).toHaveCount(TOTAL_ITEMS * 2);
});

test('answering a question records 1/2 and marks it answered', async ({ page }) => {
  await startQuiz(page, '/index.html');
  const firstItem = page.locator('#items .item').first();
  await firstItem.locator('.stmt.right').click();
  await expect(firstItem).toHaveClass(/answered/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rms_answers') || '{}'));
  expect(stored['0_0']).toBe(1);
});

test('answering all enables results; total renders in [1,2]', async ({ page }) => {
  await startQuiz(page, '/index.html');
  await answerAll(page, 'binary');
  await page.locator('#showBtn').click();
  await expect(page.locator('#results')).toBeVisible();

  const total = parseFloat(await page.locator('#totalNum').textContent());
  expect(total).toBeGreaterThanOrEqual(1);
  expect(total).toBeLessThanOrEqual(2);
  await expect(page.locator('#radar')).toBeVisible();
});
