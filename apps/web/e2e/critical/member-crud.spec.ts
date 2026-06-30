import { test, expect } from '../fixtures/base';
import { MemberPage, type MemberData } from '../pages/MemberPage';

function uniqueMember(overrides: Partial<MemberData> = {}): MemberData {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return {
    name: `Test Member ${suffix}`,
    email: `test${suffix}@example.com`,
    phone: `081${suffix.slice(-9).padStart(9, '0')}`,
    address: 'Jl. Test No. 123',
    birthDate: '1990-01-01',
    gender: 'MALE',
    ...overrides,
  };
}

test.describe('Member CRUD', () => {
  let memberPage: MemberPage;

  test.beforeEach(async ({ loginAs }) => {
    // Login as admin who can manage members
    const page = await loginAs('ADMIN_CABANG');
    memberPage = new MemberPage(page);
    await memberPage.goto();
  });

  test('should create a new member', async () => {
    const member = uniqueMember();

    // Create member
    await memberPage.createMember(member);

    // Verify member appears in list
    await memberPage.searchMember(member.name);
    await memberPage.expectMemberExists(member.name);
  });

  test('should search for a member', async () => {
    const member = uniqueMember();
    await memberPage.createMember(member);

    // Search for specific member
    await memberPage.searchMember(member.name);
    
    // Verify search results
    const count = await memberPage.getMemberCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should view member details', async ({ page }) => {
    const member = uniqueMember();

    // Create a test member first
    await memberPage.createMember(member);

    // Search and view
    await memberPage.searchMember(member.name);
    await memberPage.viewMember(member.name);

    // Verify we're on detail page
    await expect(page).toHaveURL(/\/members\/[^/]+$/);
    await expect(page.locator('h1, h2')).toContainText(member.name);
  });

  test('should edit member information', async ({ loginAs }) => {
    const member = uniqueMember();

    // Create a test member first
    await memberPage.createMember(member);

    const page = await loginAs('SUPER_ADMIN');
    const superAdminMemberPage = new MemberPage(page);
    await superAdminMemberPage.goto();
    await superAdminMemberPage.searchMember(member.name);
    await superAdminMemberPage.editMember(member.name);

    // Update name
    const updatedName = `${member.name} Updated`;
    await page.locator('[name="fullName"]').fill(updatedName);
    await superAdminMemberPage.submitForm();

    // Verify update
    await superAdminMemberPage.goto();
    await superAdminMemberPage.searchMember(updatedName);
    await superAdminMemberPage.expectMemberExists(updatedName);
  });

  test('should delete a member', async () => {
    test.fixme(true, 'Delete member action is not exposed in the current member list/detail UI.');
    const member = uniqueMember();

    // Create a test member first
    await memberPage.createMember(member);

    // Delete member
    await memberPage.searchMember(member.name);
    await memberPage.deleteMember(member.name);

    // Verify member is deleted
    await memberPage.searchMember(member.name);
    await memberPage.expectMemberNotExists(member.name);
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
  let testMember: MemberData;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    memberPage = new MemberPage(page);
    await memberPage.goto();
    testMember = uniqueMember();

    // Create a test member
    await memberPage.createMember(testMember);
  });

  test('should assign therapy package to member', async () => {
    // Assign package
    await memberPage.assignPackage(testMember.name, 'Basic Package');

    // Verify package is assigned
    await memberPage.expectPackageAssigned('Basic Package');
  });

  test('should assign multiple packages to member', async () => {
    // Assign first package
    await memberPage.assignPackage(testMember.name, 'Basic Package');
    await memberPage.expectPackageAssigned('Basic Package');

    // Assign second package
    await memberPage.assignPackage(testMember.name, 'Premium Package');
    await memberPage.expectPackageAssigned('Premium Package');

    // Verify both packages are visible
    await memberPage.expectPackageAssigned('Basic Package');
    await memberPage.expectPackageAssigned('Premium Package');
  });
});
