const { expect } = require('@playwright/test');

// Total number of questions across all 12 categories.
const TOTAL_ITEMS = 36;

// Number of categories.
const TOTAL_CATS = 12;

/**
 * Answer every question on a quiz page that is already showing the quiz form.
 * mode 'binary' clicks statement-A buttons; mode 'scale4' picks the first radio
 * of each question. Returns once the results button is enabled.
 */
async function answerAll(page, mode) {
  if (mode === 'binary') {
    const buttons = page.locator('#items .stmt.right');
    const n = await buttons.count();
    for (let i = 0; i < n; i++) await buttons.nth(i).click();
  } else {
    // Pick the first radio (index 0) of every question.
    const groups = page.locator('#items .scale4-radios');
    const n = await groups.count();
    for (let i = 0; i < n; i++) {
      await groups.nth(i).locator('input[type="radio"]').first().check();
    }
  }
  await expect(page.locator('#showBtn')).toBeEnabled();
}

/** Open a version page and click "start" to reveal the quiz form. */
async function startQuiz(page, path) {
  await page.goto(path);
  await page.getByRole('button', { name: /נתחיל/ }).click();
  await expect(page.locator('#quiz')).toBeVisible();
}

module.exports = { TOTAL_ITEMS, TOTAL_CATS, answerAll, startQuiz };
