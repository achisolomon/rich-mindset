const { test, expect } = require('@playwright/test');
const { answerAll, startQuiz } = require('./helpers');

test('binary and scale4 use separate storage keys', async ({ page }) => {
  await startQuiz(page, '/index.html');
  await page.locator('#items .stmt.right').first().click();
  await startQuiz(page, '/scale4.html');
  await page.locator('#items .scale4-radios').first().locator('input').nth(3).check();

  const keys = await page.evaluate(() => ({
    binary: localStorage.getItem('rms_answers_binary'),
    scale4: localStorage.getItem('rms_answers_scale4'),
  }));
  expect(JSON.parse(keys.binary)['0_0']).toBe(1);          // binary untouched
  expect(JSON.parse(keys.scale4)['0_0']).toBeCloseTo(2.0, 3); // scale4 independent
});
