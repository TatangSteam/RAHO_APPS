import type { Locator, Page } from '@playwright/test';

export const E2E_API_HEADERS = {
  'X-E2E-Test': 'true',
} as const;

export const SEARCH_INPUT_PLACEHOLDER = /cari|search/i;
export const EMPTY_STATE_TEXT = /tidak.*ada.*data|tidak.*ada.*sesi|tidak.*ada.*invoice|tidak.*ada.*notifikasi|tidak.*ada.*laporan|no.*data|empty|kosong/i;
export const CONFIRM_BUTTON_NAME = /^hapus$|^ya$|^yes$|konfirmasi|confirm/i;
export const DEFAULT_DEBOUNCE_MS = 500;

export const SELECTORS = {
  modal: '[role="dialog"], .modal, [data-modal], .fixed.inset-0',
  modalCloseTarget: '[role="dialog"], .modal, [data-modal]',
  toast: '[role="status"]:not(#__next-route-announcer__), [role="alert"]:not(#__next-route-announcer__), [data-sonner-toast]',
  table: 'table, [role="table"]',
  tableRow: 'tbody tr, [role="row"]',
} as const;

export function modalLocator(page: Page): Locator {
  return page.locator(SELECTORS.modal);
}

export function activeModal(page: Page): Locator {
  return modalLocator(page).last();
}

export function tableLocator(page: Page): Locator {
  return page.locator(SELECTORS.table).first();
}

export function tableRowLocator(scope: Page | Locator, text: string | RegExp): Locator {
  return scope.locator(SELECTORS.tableRow).filter({ hasText: text });
}

export function searchInput(page: Page): Locator {
  return page.getByPlaceholder(SEARCH_INPUT_PLACEHOLDER);
}

export async function waitForDebounce(page: Page, timeout = DEFAULT_DEBOUNCE_MS): Promise<void> {
  await page.waitForTimeout(timeout);
}
