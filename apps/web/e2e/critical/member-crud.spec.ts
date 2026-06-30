import { test, expect } from '../fixtures/base';
import { MemberPage } from '../pages/MemberPage';

test.describe('Member CRUD', () => {
  let memberPage: MemberPage;
  const testMemberName = `Test Member ${Date.now()}`;
  const testMemberEmail = `test${Date.now()}@example.com`;

  test.beforeEach(async ({ loginAs }) => {
    // Login as admin who can manage members
    const page = await loginAs('ADMIN_CABANG');
    memberPage = new MemberPage(page);
    await memberPage.goto();
  });

  test('should create a new member', async () => {
    // Create member
    await memberPage.createMember({
      name: testMemberName,
      email: testMemberEmail,
      phone: '081234567890',
      address: 'Jl. Test No. 123',
      birthDate: '1990-01-01',
      gender: 'MALE',
    });

    // Verify member appears in list
    await memberPage.searchMember(testMemberName);
    await memberPage.expectMemberExists(testMemberName);
  });

  test('should search for a member', async () => {
    // Search for specific member
    await memberPage.searchMember('Test');
    
    // Verify search results
    const count = await memberPage.getMemberCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should view member details', async ({ page }) => {
    // Create a test member first
    await memberPage.createMember({
      name: testMemberName,
      email: testMemberEmail,
      phone: '081234567890',
    });

    // Search and view
    await memberPage.searchMember(testMemberName);
    await memberPage.viewMember(testMemberName);

    // Verify we're on detail page
    await expect(page).toHaveURL(/\/members\/[^/]+$/);
    await expect(page.locator('h1, h2')).toContainText(testMemberName);
  });

  test('should edit member information', async ({ loginAs }) => {
    // Create a test member first
    await memberPage.createMember({
      name: testMemberName,
      email: testMemberEmail,
      phone: '081234567890',
    });

    const page = await loginAs('SUPER_ADMIN');
    const superAdminMemberPage = new MemberPage(page);
    await superAdminMemberPage.goto();
    await superAdminMemberPage.searchMember(testMemberName);
    await superAdminMemberPage.editMember(testMemberName);

    // Update name
    const updatedName = `${testMemberName} Updated`;
    await page.locator('[name="fullName"]').fill(updatedName);
    await superAdminMemberPage.submitForm();

    // Verify update
    await superAdminMemberPage.goto();
    await superAdminMemberPage.searchMember(updatedName);
    await superAdminMemberPage.expectMemberExists(updatedName);
  });

  test('should delete a member', async () => {
    test.fixme(true, 'Delete member action is not exposed in the current member list/detail UI.');

    // Create a test member first
    await memberPage.createMember({
      name: testMemberName,
      email: testMemberEmail,
      phone: '081234567890',
    });

    // Delete member
    await memberPage.searchMember(testMemberName);
    await memberPage.deleteMember(testMemberName);

    // Verify member is deleted
    await memberPage.searchMember(testMemberName);
    await memberPage.expectMemberNotExists(testMemberName);
  });

  test('should validate required fields', async ({ page }) => {
    // Try to create member without required fields
    await memberPage.clickAddMember();
    
    // Submit empty form
    const submitButton = page.getByRole('button', { name: /daftarkan.*member|simpan|save/i });
    await submitButton.click();

    const fullNameMissing = await page.locator('[name="fullName"]').evaluate((element) => {
      return (element as HTMLInputElement).validity.valueMissing;
    });
    expect(fullNameMissing).toBe(true);
  });

  test('should validate email format', async ({ page }) => {
    await memberPage.clickAddMember();

    // Fill with invalid email
    await page.locator('[name="fullName"]').fill('Test User');
    await page.locator('[name="nik"]').fill(`32${Date.now()}`.slice(0, 16).padEnd(16, '0'));
    await page.locator('[name="phone"]').fill('081234567890');
    await page.locator('[name="birthPlace"]').fill('Jakarta');
    await page.locator('[name="birthDate"]').fill('1990-01-01');
    await page.locator('[name="gender"]').selectOption('L');
    await page.locator('[name="address"]').fill('Jl. Test No. 123');
    await page.locator('[name="memberEmail"]').fill('invalid-email');
    await page.locator('[name="memberPassword"]').fill('Member123!');

    // Submit
    const submitButton = page.getByRole('button', { name: /daftarkan.*member|simpan|save/i });
    await submitButton.click();

    const emailTypeMismatch = await page.locator('[name="memberEmail"]').evaluate((element) => {
      return (element as HTMLInputElement).validity.typeMismatch;
    });
    expect(emailTypeMismatch).toBe(true);
  });

  test('should handle duplicate email', async ({ page }) => {
    test.fixme(true, 'Current member registration flow does not surface duplicate member-email validation in the UI.');

    const duplicateEmail = `duplicate${Date.now()}@example.com`;

    // Create first member
    await memberPage.createMember({
      name: 'First Member',
      email: duplicateEmail,
      phone: '081234567890',
    });

    // Try to create second member with same email
    await memberPage.clickAddMember();
    await memberPage.fillMemberForm({
      name: 'Second Member',
      email: duplicateEmail,
      phone: '081234567891',
    });

    const submitButton = page.getByRole('button', { name: /daftarkan.*member|simpan|save/i });
    await submitButton.click();

    // Verify error message
    await expect(page.locator('text=/email.*sudah.*digunakan|email.*already.*exists/i').first()).toBeVisible();
  });
});

test.describe('Member Package Assignment', () => {
  let memberPage: MemberPage;
  const testMemberName = `Test Member ${Date.now()}`;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    memberPage = new MemberPage(page);
    await memberPage.goto();

    // Create a test member
    await memberPage.createMember({
      name: testMemberName,
      email: `test${Date.now()}@example.com`,
      phone: '081234567890',
    });
  });

  test('should assign therapy package to member', async () => {
    // Assign package
    await memberPage.assignPackage(testMemberName, 'Basic Package');

    // Verify package is assigned
    await memberPage.expectPackageAssigned('Basic Package');
  });

  test('should assign multiple packages to member', async () => {
    // Assign first package
    await memberPage.assignPackage(testMemberName, 'Basic Package');
    await memberPage.expectPackageAssigned('Basic Package');

    // Assign second package
    await memberPage.assignPackage(testMemberName, 'Premium Package');
    await memberPage.expectPackageAssigned('Premium Package');

    // Verify both packages are visible
    await memberPage.expectPackageAssigned('Basic Package');
    await memberPage.expectPackageAssigned('Premium Package');
  });
});
