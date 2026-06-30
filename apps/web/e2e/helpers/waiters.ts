import { Page, expect } from '@playwright/test';

/**
 * Common wait helpers for async operations
 */

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoadingToFinish(page: Page, timeout = 10000) {
  try {
    // Wait for any loading overlay to disappear
    await page.waitForSelector('[role="progressbar"], .animate-spin', {
      state: 'hidden',
      timeout,
    });
  } catch (error) {
    // Loading might have finished before we checked
    // This is okay
  }
}

/**
 * Wait for toast notification to appear
 */
export async function waitForToast(page: Page, message?: string | RegExp) {
  const toast = page.locator('[role="status"], [role="alert"], [data-sonner-toast]').first();
  await toast.waitFor({ state: 'visible', timeout: 5000 });
  
  if (message) {
    await expect(toast).toContainText(message);
  }
  
  return toast;
}

/**
 * Wait for success toast
 */
export async function waitForSuccessToast(page: Page, message?: string | RegExp) {
  await waitForToast(page, message);
}

/**
 * Wait for error toast
 */
export async function waitForErrorToast(page: Page, message?: string | RegExp) {
  await waitForToast(page, message);
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
) {
  return await page.waitForResponse(
    (response) => {
      const url = response.url();
      const matches = typeof urlPattern === 'string' 
        ? url.includes(urlPattern)
        : urlPattern.test(url);
      return matches && response.status() < 400;
    },
    { timeout }
  );
}

/**
 * Wait for modal to open
 */
export async function waitForModal(page: Page) {
  const modal = page.locator('[role="dialog"], .modal, [data-modal], .fixed.inset-0').first();
  await expect(modal).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for modal to close
 */
export async function waitForModalClose(page: Page) {
  await page.waitForSelector('[role="dialog"], .modal, [data-modal]', {
    state: 'hidden',
    timeout: 5000,
  });
}

export async function waitForModalToClose(page: Page) {
  await waitForModalClose(page);
}

/**
 * Wait for table to load
 */
export async function waitForTableToLoad(page: Page) {
  await waitForLoadingToFinish(page);

  const tableOrEmptyState = page
    .locator('table, [role="table"]')
    .or(page.getByText(/tidak.*ada.*data|no.*data|kosong/i))
    .first();

  await expect(tableOrEmptyState).toBeVisible({ timeout: 10000 });
  await waitForLoadingToFinish(page);
}

export async function waitForTableLoad(page: Page) {
  await waitForTableToLoad(page);
}

/**
 * Wait for form to be ready
 */
export async function waitForFormReady(page: Page) {
  await page.waitForSelector('form', { state: 'visible' });
  await waitForLoadingToFinish(page);
}

/**
 * Wait for button to be enabled
 */
export async function waitForButtonEnabled(page: Page, buttonText: string | RegExp) {
  const button = page.getByRole('button', { name: buttonText });
  await expect(button).toBeEnabled({ timeout: 5000 });
}

/**
 * Wait for navigation to complete
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });
  await waitForLoadingToFinish(page);
}
