const { test, expect } = require('@playwright/test');

test('landing page links to both versions', async ({ page }) => {
  await page.goto('/versions.html');
  const binaryLink = page.locator('a[href="index.html"]');
  const scale4Link = page.locator('a[href="scale4.html"]');
  await expect(binaryLink).toBeVisible();
  await expect(scale4Link).toBeVisible();

  await binaryLink.click();
  await expect(page).toHaveURL(/index\.html$/);
  await expect(page.locator('#intro')).toBeVisible();
});

test('scale4 link resolves to the 4-radio version', async ({ page }) => {
  await page.goto('/versions.html');
  await page.locator('a[href="scale4.html"]').click();
  await expect(page).toHaveURL(/scale4\.html$/);
  await expect(page.locator('#intro')).toBeVisible();
});
