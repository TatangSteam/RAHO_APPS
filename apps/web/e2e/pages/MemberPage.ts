import { Page, expect, Locator } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast, waitForModal, waitForModalClose, waitForTableToLoad } from '../helpers/waiters';

export interface MemberData {
  name: string;
  email: string;
  phone: string;
  address?: string;
  birthDate?: string;
  gender?: 'MALE' | 'FEMALE';
}

export class MemberPage {
  readonly page: Page;
  readonly addMemberButton: Locator;
  readonly searchInput: Locator;
  readonly memberTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addMemberButton = page.getByRole('button', { name: /tambah|add.*member/i });
    this.searchInput = page.getByPlaceholder(/cari|search/i);
    this.memberTable = page.locator('table').first();
  }

  /**
   * Navigate to members page
   */
  async goto() {
    await this.page.goto('/members');
    await waitForTableToLoad(this.page);
  }

  /**
   * Click add member button
   */
  async clickAddMember() {
    await this.addMemberButton.click();
    await this.page.waitForURL(/\/members\/new/);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Fill member form
   */
  async fillMemberForm(data: MemberData) {
    // Fill name
    await this.page.getByLabel(/nama|name/i).fill(data.name);

    // Fill email
    await this.page.getByLabel(/email/i).fill(data.email);

    // Fill phone
    await this.page.getByLabel(/telepon|phone/i).fill(data.phone);

    // Fill address (optional)
    if (data.address) {
      await this.page.getByLabel(/alamat|address/i).fill(data.address);
    }

    // Fill birth date (optional)
    if (data.birthDate) {
      await this.page.getByLabel(/tanggal lahir|birth.*date/i).fill(data.birthDate);
    }

    // Select gender (optional)
    if (data.gender) {
      await this.page.getByLabel(/jenis kelamin|gender/i).selectOption(data.gender);
    }
  }

  /**
   * Submit member form
   */
  async submitForm() {
    const submitButton = this.page.getByRole('button', { name: /simpan|save|submit/i });
    await submitButton.click();
    
    // Wait for success
    await waitForSuccessToast(this.page);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Create new member
   */
  async createMember(data: MemberData) {
    await this.clickAddMember();
    await this.fillMemberForm(data);
    await this.submitForm();
    
    // Should redirect to members list
    await this.page.waitForURL(/\/members$/);
  }

  /**
   * Search for member
   */
  async searchMember(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Get member row by name
   */
  getMemberRow(name: string) {
    return this.memberTable.locator('tr').filter({ hasText: name });
  }

  /**
   * Click edit button for a member
   */
  async editMember(memberName: string) {
    const row = this.getMemberRow(memberName);
    await row.getByRole('button', { name: /edit|ubah/i }).click();
    await this.page.waitForURL(/\/members\/[^/]+$/);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Click view button for a member
   */
  async viewMember(memberName: string) {
    const row = this.getMemberRow(memberName);
    await row.getByRole('link', { name: /view|lihat|detail/i }).click();
    await this.page.waitForURL(/\/members\/[^/]+$/);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Delete member
   */
  async deleteMember(memberName: string) {
    const row = this.getMemberRow(memberName);
    
    // Click delete button
    await row.getByRole('button', { name: /delete|hapus/i }).click();
    
    // Confirm deletion in dialog
    await waitForModal(this.page);
    const confirmButton = this.page.getByRole('button', { name: /ya|yes|konfirmasi|confirm/i });
    await confirmButton.click();
    
    // Wait for success
    await waitForSuccessToast(this.page, /berhasil dihapus|deleted successfully/i);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Verify member exists in table
   */
  async expectMemberExists(memberName: string) {
    const row = this.getMemberRow(memberName);
    await expect(row).toBeVisible();
  }

  /**
   * Verify member does not exist in table
   */
  async expectMemberNotExists(memberName: string) {
    const row = this.getMemberRow(memberName);
    await expect(row).not.toBeVisible();
  }

  /**
   * Get member count
   */
  async getMemberCount(): Promise<number> {
    const rows = await this.memberTable.locator('tbody tr').count();
    return rows;
  }

  /**
   * Assign package to member
   */
  async assignPackage(memberName: string, packageName: string) {
    await this.viewMember(memberName);
    
    // Click assign package button
    const assignButton = this.page.getByRole('button', { name: /assign|tambah.*paket/i });
    await assignButton.click();
    
    // Wait for modal
    await waitForModal(this.page);
    
    // Select package
    await this.page.getByLabel(/paket|package/i).selectOption({ label: new RegExp(packageName, 'i') });
    
    // Submit
    const submitButton = this.page.getByRole('button', { name: /simpan|save/i });
    await submitButton.click();
    
    // Wait for success
    await waitForSuccessToast(this.page);
    await waitForModalClose(this.page);
  }

  /**
   * Verify package is assigned
   */
  async expectPackageAssigned(packageName: string) {
    const packageCard = this.page.locator('[data-testid="package-card"], .package-item').filter({ hasText: new RegExp(packageName, 'i') });
    await expect(packageCard).toBeVisible();
  }
}
