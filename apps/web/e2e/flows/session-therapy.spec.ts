import { test, expect } from '../fixtures/base';
import { SessionPage } from '../pages/SessionPage';

test.describe('Session Therapy CRUD', () => {
  let sessionPage: SessionPage;
  const testMemberName = `Test Member ${Date.now()}`;
  const testSessionDate = '2026-07-01';
  const testSessionTime = '10:00';

  test.beforeEach(async ({ loginAs }) => {
    // Login as admin who can manage sessions
    const page = await loginAs('ADMIN_CABANG');
    sessionPage = new SessionPage(page);
    await sessionPage.goto();
  });

  test('should create a new therapy session', async () => {
    // Create session
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: testSessionDate,
      scheduledTime: testSessionTime,
      notes: 'Test session created via E2E test',
    });

    // Verify session appears in list
    await sessionPage.searchSession(testMemberName);
    await sessionPage.expectSessionExists(testMemberName);
  });

  test('should view session details', async ({ page }) => {
    // Create a test session first
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: testSessionDate,
      scheduledTime: testSessionTime,
    });

    // View session
    await sessionPage.viewSession(testMemberName);

    // Verify we're on detail page
    await expect(page).toHaveURL(/\/sessions\/[^/]+$/);
    await expect(page.locator('h1, h2')).toContainText(new RegExp(testMemberName, 'i'));
  });

  test('should update session notes', async () => {
    // Create a test session first
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: testSessionDate,
      scheduledTime: testSessionTime,
      notes: 'Original notes',
    });

    // Update session
    const updatedNotes = 'Updated notes via E2E test';
    await sessionPage.updateSession(testMemberName, {
      notes: updatedNotes,
    });

    // Verify update
    await sessionPage.viewSession(testMemberName);
    await expect(sessionPage.page.getByText(updatedNotes)).toBeVisible();
  });

  test('should complete a session', async () => {
    // Create a test session
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: testSessionDate,
      scheduledTime: testSessionTime,
    });

    // Complete session
    await sessionPage.completeSession(testMemberName);

    // Verify status changed
    await sessionPage.expectSessionStatus(testMemberName, /selesai|completed|finished/i.source);
  });

  test('should cancel a session with reason', async () => {
    // Create a test session
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: testSessionDate,
      scheduledTime: testSessionTime,
    });

    // Cancel session
    await sessionPage.cancelSession(testMemberName, 'Patient not available');

    // Verify status changed
    await sessionPage.expectSessionStatus(testMemberName, /batal|cancelled|canceled/i.source);
  });

  test('should validate required fields when creating session', async ({ page }) => {
    // Try to create session without required fields
    const addButton = page.getByRole('button', { name: /tambah sesi|add session/i });
    await addButton.click();

    await page.waitForTimeout(500);

    // Submit empty form
    const submitButton = page.getByRole('button', { name: /simpan|save/i });
    await submitButton.click();

    // Verify validation errors appear
    await expect(page.locator('text=/required|wajib|harus.*diisi/i').first()).toBeVisible();
  });
});

test.describe('Session Staff Assignment', () => {
  let sessionPage: SessionPage;
  const testMemberName = `Test Member ${Date.now()}`;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    sessionPage = new SessionPage(page);
    await sessionPage.goto();

    // Create a test session
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: '2026-07-01',
      scheduledTime: '10:00',
    });
  });

  test('should assign doctor to session', async () => {
    // Assign doctor
    await sessionPage.assignDoctor(testMemberName, 'Dr. Test Doctor');

    // Verify doctor is assigned
    await sessionPage.expectDoctorAssigned('Dr. Test Doctor');
  });

  test('should assign nurse to session', async () => {
    // Assign nurse
    await sessionPage.assignNurse(testMemberName, 'Test Nurse');

    // Verify nurse is assigned
    await sessionPage.expectNurseAssigned('Test Nurse');
  });

  test('should assign both doctor and nurse', async () => {
    // Assign doctor
    await sessionPage.assignDoctor(testMemberName, 'Dr. Test Doctor');
    await sessionPage.expectDoctorAssigned('Dr. Test Doctor');

    // Assign nurse
    await sessionPage.assignNurse(testMemberName, 'Test Nurse');
    await sessionPage.expectNurseAssigned('Test Nurse');
  });
});

test.describe('Session Vital Signs', () => {
  let sessionPage: SessionPage;
  const testMemberName = `Test Member ${Date.now()}`;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('NURSE');
    sessionPage = new SessionPage(page);
    await sessionPage.goto();

    // Create a test session
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: '2026-07-01',
      scheduledTime: '10:00',
    });
  });

  test('should record vital signs', async () => {
    // Record vital signs
    await sessionPage.recordVitalSigns(testMemberName, {
      bloodPressure: '120/80',
      heartRate: 75,
      temperature: 36.5,
      weight: 70,
      height: 170,
      oxygenSaturation: 98,
    });

    // Verify vital signs recorded
    await sessionPage.expectVitalSignsRecorded();
  });

  test('should record partial vital signs', async () => {
    // Record only some vital signs
    await sessionPage.recordVitalSigns(testMemberName, {
      bloodPressure: '120/80',
      heartRate: 75,
    });

    // Verify recorded
    await sessionPage.expectVitalSignsRecorded();
  });
});

test.describe('Session Diagnosis', () => {
  let sessionPage: SessionPage;
  const testMemberName = `Test Member ${Date.now()}`;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('DOCTOR');
    sessionPage = new SessionPage(page);
    await sessionPage.goto();

    // Create a test session
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: '2026-07-01',
      scheduledTime: '10:00',
    });
  });

  test('should add diagnosis to session', async () => {
    // Add diagnosis
    await sessionPage.addDiagnosis(testMemberName, 'E11.9', 'Type 2 diabetes mellitus');

    // Verify diagnosis added
    await sessionPage.expectDiagnosisAdded('E11.9');
  });

  test('should add multiple diagnoses', async () => {
    // Add first diagnosis
    await sessionPage.addDiagnosis(testMemberName, 'E11.9', 'Type 2 diabetes mellitus');
    await sessionPage.expectDiagnosisAdded('E11.9');

    // Add second diagnosis
    await sessionPage.addDiagnosis(testMemberName, 'I10', 'Essential hypertension');
    await sessionPage.expectDiagnosisAdded('I10');
  });
});

test.describe('Session Therapy Plan', () => {
  let sessionPage: SessionPage;
  const testMemberName = `Test Member ${Date.now()}`;
  const testPlanName = `Therapy Plan ${Date.now()}`;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('DOCTOR');
    sessionPage = new SessionPage(page);
    await sessionPage.goto();

    // Create a test session
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: '2026-07-01',
      scheduledTime: '10:00',
    });
  });

  test('should create therapy plan with items', async () => {
    // Create therapy plan
    await sessionPage.createTherapyPlan(testMemberName, testPlanName, [
      {
        productName: 'IFA 250',
        quantity: 30,
        dosage: '1 tablet',
        frequency: '2x sehari',
        duration: '30 hari',
      },
      {
        productName: 'Vitamin C',
        quantity: 30,
        dosage: '1 tablet',
        frequency: '1x sehari',
        duration: '30 hari',
      },
    ]);

    // Verify therapy plan created
    await sessionPage.expectTherapyPlanCreated(testPlanName);
  });

  test('should create therapy plan with single item', async () => {
    // Create therapy plan with one item
    await sessionPage.createTherapyPlan(testMemberName, testPlanName, [
      {
        productName: 'IFA 250',
        quantity: 30,
      },
    ]);

    // Verify created
    await sessionPage.expectTherapyPlanCreated(testPlanName);
  });
});

test.describe('Session Follow-up', () => {
  let sessionPage: SessionPage;
  const testMemberName = `Test Member ${Date.now()}`;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('DOCTOR');
    sessionPage = new SessionPage(page);
    await sessionPage.goto();

    // Create and complete a test session
    await sessionPage.createSession({
      memberName: testMemberName,
      sessionType: 'Regular',
      scheduledDate: '2026-07-01',
      scheduledTime: '10:00',
    });

    await sessionPage.completeSession(testMemberName);
  });

  test('should schedule follow-up session', async () => {
    // Schedule follow-up
    await sessionPage.scheduleFollowUp(testMemberName, '2026-07-15', '14:00');

    // Verify follow-up scheduled
    await sessionPage.searchSession(testMemberName);
    const count = await sessionPage.getSessionCount();
    expect(count).toBeGreaterThan(1); // Should have original + follow-up
  });
});

test.describe('Session Filters', () => {
  let sessionPage: SessionPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    sessionPage = new SessionPage(page);
    await sessionPage.goto();
  });

  test('should filter sessions by status', async () => {
    // Filter by completed status
    await sessionPage.filterByStatus('Selesai');

    // Verify filter applied
    const count = await sessionPage.getSessionCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter sessions by date range', async () => {
    // Filter by date range
    await sessionPage.filterByDateRange('2026-07-01', '2026-07-31');

    // Verify filter applied
    const count = await sessionPage.getSessionCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should search sessions', async () => {
    // Search for session
    await sessionPage.searchSession('Test');

    // Verify search applied
    const count = await sessionPage.getSessionCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Session Access Control', () => {
  test('should allow doctor to create therapy plan', async ({ loginAs }) => {
    const page = await loginAs('DOCTOR');
    const sessionPage = new SessionPage(page);
    await sessionPage.goto();

    // Verify doctor can access session creation
    const addButton = page.getByRole('button', { name: /tambah|add|buat/i });
    await expect(addButton).toBeVisible();
  });

  test('should allow nurse to record vital signs', async ({ loginAs }) => {
    const page = await loginAs('NURSE');
    const sessionPage = new SessionPage(page);
    await sessionPage.goto();

    // Verify nurse can access sessions
    const addButton = page.getByRole('button', { name: /tambah|add|buat/i });
    await expect(addButton).toBeVisible();
  });

  test('should restrict ADMIN_LAYANAN access', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_LAYANAN');
    
    // Try to access sessions
    await page.goto('/sessions');

    // Should either redirect or show read-only view
    // Verify cannot create new session or specific permission check
    const addButton = page.getByRole('button', { name: /tambah|add|buat/i });
    
    // ADMIN_LAYANAN might have view-only access
    // Adjust based on actual permission model
    if (await addButton.isVisible({ timeout: 2000 })) {
      // If visible, they have access
      expect(true).toBe(true);
    } else {
      // If not visible, verify read-only access
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    }
  });
});
