const { test, expect } = require('@playwright/test');
const { TOTAL_CATS, answerAll, startQuiz } = require('./helpers');

// Answering all strong-A (binary stmt-A == scale4 idx0) yields the minimum
// score 1.0 in BOTH versions — proving the score scales are comparable.
test('binary all-A gives total 1.0', async ({ page }) => {
  await startQuiz(page, '/index.html');
  await answerAll(page, 'binary'); // helper clicks stmt.right (A)
  await page.locator('#showBtn').click();
  expect(parseFloat(await page.locator('#totalNum').textContent())).toBeCloseTo(1.0, 2);
});

test('scale4 all-strong-A gives total 1.0', async ({ page }) => {
  await startQuiz(page, '/scale4.html');
  await answerAll(page, 'scale4'); // helper checks idx0 (strong A)
  await page.locator('#showBtn').click();
  expect(parseFloat(await page.locator('#totalNum').textContent())).toBeCloseTo(1.0, 2);
});

test('breakdown shows all categories and they expand', async ({ page }) => {
  await startQuiz(page, '/index.html');
  await answerAll(page, 'binary');
  await page.locator('#showBtn').click();
  await expect(page.locator('#breakdown .res-row')).toHaveCount(TOTAL_CATS);
  const firstHead = page.locator('#breakdown .res-head').first();
  await firstHead.click();
  await expect(firstHead).toHaveAttribute('aria-expanded', 'true');
});
