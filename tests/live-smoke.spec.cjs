const { test, expect } = require('@playwright/test');

const APP_URL = 'https://amwemari.eckson.workers.dev';

test('live site loads and presents the sign-in interface', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/AMWEMARI/i);
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  expect(pageErrors, 'Uncaught browser JavaScript errors').toEqual([]);
});

test('test account can sign in and remains signed in after refresh', async ({ page }) => {
  const email = process.env.AMWEMARI_TEST_EMAIL;
  const password = process.env.AMWEMARI_TEST_PASSWORD;
  test.skip(!email || !password, 'Add AMWEMARI_TEST_EMAIL and AMWEMARI_TEST_PASSWORD repository secrets to run authenticated checks.');

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#authSubmit').click();

  await expect(page.locator('#authForm')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: 30000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#authForm')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: 30000 });
  expect(pageErrors, 'Uncaught browser JavaScript errors during sign-in/refresh').toEqual([]);
});
