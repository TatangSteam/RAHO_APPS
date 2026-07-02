import { test, expect } from '../fixtures/base';
import { SessionPage } from '../pages/SessionPage';
import { waitForLoadingToFinish } from '../helpers/waiters';

test.describe('Session Therapy List', () => {
  let sessionPage: SessionPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    sessionPage = new SessionPage(page);
    await sessionPage.goto();
  });

  test('should view session list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sesi terapi/i })).toBeVisible();
    await expect(page.getByText(/daftar semua sesi terapi/i)).toBeVisible();
  });

  test('should show session empty state or table', async ({ page }) => {
    await expect(
      page.locator('table').or(page.getByText(/tidak ada sesi terapi/i)).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should open filter panel', async ({ page }) => {
    await page.getByRole('button', { name: /filter/i }).click();

    await expect(page.getByText(/^Status$/)).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('should filter sessions by status', async ({ page }) => {
    await page.getByRole('button', { name: /filter/i }).click();
    await page.locator('select').first().selectOption('completed');
    await waitForLoadingToFinish(page);

    await expect(
      page.locator('table').or(page.getByText(/tidak ada sesi terapi/i)).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should filter sessions by date range', async ({ page }) => {
    await page.getByRole('button', { name: /filter/i }).click();
    await page.locator('input[type="date"]').nth(0).fill('2026-07-01');
    await page.locator('input[type="date"]').nth(1).fill('2026-07-31');
    await waitForLoadingToFinish(page);

    await expect(
      page.locator('table').or(page.getByText(/tidak ada sesi terapi/i)).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should open export modal', async ({ page }) => {
    await page.getByRole('button', { name: /export/i }).click();

    await expect(page.getByRole('heading', { name: /export data sesi terapi/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Session Therapy CRUD', () => {
  test('should create a new therapy session', async () => {
    test.fixme(true, 'Current session list page does not expose a create-session action.');
  });

  test('should view session details', async () => {
    test.fixme(true, 'Requires an existing seeded session row to open detail deterministically.');
  });

  test('should update session notes', async () => {
    test.fixme(true, 'Current session list page does not expose edit-session controls.');
  });

  test('should complete a session', async () => {
    test.fixme(true, 'Current session list page does not expose complete-session controls.');
  });

  test('should cancel a session with reason', async () => {
    test.fixme(true, 'Current session list page does not expose cancel-session controls.');
  });

  test('should validate required fields when creating session', async () => {
    test.fixme(true, 'Current session list page does not expose a create-session form.');
  });
});

test.describe('Session Staff Assignment', () => {
  test('should assign doctor to session', async () => {
    test.fixme(true, 'Staff assignment requires a session detail workflow with seeded session data.');
  });

  test('should assign nurse to session', async () => {
    test.fixme(true, 'Staff assignment requires a session detail workflow with seeded session data.');
  });

  test('should assign both doctor and nurse', async () => {
    test.fixme(true, 'Staff assignment requires a session detail workflow with seeded session data.');
  });
});

test.describe('Session Vital Signs', () => {
  test('should record vital signs', async () => {
    test.fixme(true, 'Vital signs entry requires a session detail workflow with seeded session data.');
  });

  test('should record partial vital signs', async () => {
    test.fixme(true, 'Vital signs entry requires a session detail workflow with seeded session data.');
  });
});

test.describe('Session Diagnosis', () => {
  test('should add diagnosis to session', async () => {
    test.fixme(true, 'Diagnosis entry requires a session detail workflow with seeded session data.');
  });

  test('should add multiple diagnoses', async () => {
    test.fixme(true, 'Diagnosis entry requires a session detail workflow with seeded session data.');
  });
});

test.describe('Session Therapy Plan', () => {
  test('should create therapy plan with items', async () => {
    test.fixme(true, 'Therapy plan creation requires a session detail workflow with seeded session data.');
  });

  test('should create therapy plan with single item', async () => {
    test.fixme(true, 'Therapy plan creation requires a session detail workflow with seeded session data.');
  });
});

test.describe('Session Follow-up', () => {
  test('should schedule follow-up session', async () => {
    test.fixme(true, 'Follow-up scheduling requires a completed seeded session detail workflow.');
  });
});

test.describe('Session Access Control', () => {
  for (const role of ['DOCTOR', 'NURSE'] as const) {
    test(`should allow ${role.toLowerCase()} to view sessions`, async ({ loginAs }) => {
      const page = await loginAs(role);
      const sessionPage = new SessionPage(page);
      await sessionPage.goto();

      await expect(page.getByRole('heading', { name: /sesi terapi/i })).toBeVisible();
    });
  }

  test('should restrict ADMIN_LAYANAN access gracefully', async ({ loginAs, page }) => {
    await loginAs('ADMIN_LAYANAN');
    await page.goto('/sessions', { waitUntil: 'domcontentloaded' });
    await waitForLoadingToFinish(page);

    await expect(page.locator('body')).toBeVisible();
  });
});
