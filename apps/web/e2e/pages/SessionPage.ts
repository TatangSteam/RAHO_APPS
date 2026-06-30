import { Page, expect } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast, waitForModal, waitForModalToClose, waitForTableLoad } from '../helpers/waiters';
import { goToSessions } from '../helpers/navigation';

export interface SessionData {
  memberId?: string;
  memberName?: string;
  sessionType?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  branch?: string;
  notes?: string;
}

export interface VitalSigns {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  oxygenSaturation?: number;
}

export interface TherapyPlanItem {
  productName: string;
  quantity: number;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

export class SessionPage {
  constructor(public page: Page) {}

  async goto() {
    await goToSessions(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Create a new therapy session
   */
  async createSession(data: SessionData) {
    // Click "Tambah Sesi" or "Add Session" button
    const addButton = this.page.getByRole('button', { name: /tambah sesi|add session|buat sesi|new session/i });
    await addButton.click();

    // Wait for modal/form to open
    await waitForModal(this.page);
    await waitForLoadingToFinish(this.page);

    // Fill member selection (if memberId provided)
    if (data.memberId) {
      const memberSelect = this.page.getByLabel(/member|pasien/i);
      await memberSelect.click();
      await memberSelect.fill(data.memberName || '');
      // Wait for dropdown and select
      await this.page.waitForTimeout(500);
      const memberOption = this.page.getByText(data.memberName || '').first();
      await memberOption.click();
    }

    // Fill session type
    if (data.sessionType) {
      const typeSelect = this.page.getByLabel(/tipe|type|jenis/i);
      await typeSelect.click();
      const typeOption = this.page.getByRole('option', { name: new RegExp(data.sessionType, 'i') });
      await typeOption.click();
    }

    // Fill scheduled date
    if (data.scheduledDate) {
      await this.page.getByLabel(/tanggal|date|jadwal/i).fill(data.scheduledDate);
    }

    // Fill scheduled time
    if (data.scheduledTime) {
      await this.page.getByLabel(/waktu|time|jam/i).fill(data.scheduledTime);
    }

    // Fill branch (if provided)
    if (data.branch) {
      const branchSelect = this.page.getByLabel(/cabang|branch/i);
      await branchSelect.click();
      const branchOption = this.page.getByRole('option', { name: new RegExp(data.branch, 'i') });
      await branchOption.click();
    }

    // Fill notes
    if (data.notes) {
      await this.page.getByLabel(/catatan|notes|keterangan/i).fill(data.notes);
    }

    // Submit form
    await this.submitForm();

    // Wait for success
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Search for a session by member name or session ID
   */
  async searchSession(query: string) {
    const searchInput = this.page.getByPlaceholder(/cari|search/i);
    await searchInput.fill(query);
    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * View session details
   */
  async viewSession(identifier: string) {
    // Search first
    await this.searchSession(identifier);

    // Click on the first result (detail button or row)
    const detailButton = this.page.getByRole('button', { name: /detail|view|lihat/i }).first();
    await detailButton.click();

    await waitForLoadingToFinish(this.page);
  }

  /**
   * Update session notes or details
   */
  async updateSession(identifier: string, updates: Partial<SessionData>) {
    // Search and view first
    await this.searchSession(identifier);

    // Click edit button
    const editButton = this.page.getByRole('button', { name: /edit|ubah/i }).first();
    await editButton.click();

    await waitForModal(this.page);

    // Update fields
    if (updates.notes) {
      const notesField = this.page.getByLabel(/catatan|notes/i);
      await notesField.clear();
      await notesField.fill(updates.notes);
    }

    if (updates.scheduledDate) {
      await this.page.getByLabel(/tanggal|date/i).fill(updates.scheduledDate);
    }

    if (updates.scheduledTime) {
      await this.page.getByLabel(/waktu|time/i).fill(updates.scheduledTime);
    }

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Complete a session
   */
  async completeSession(identifier: string) {
    await this.searchSession(identifier);

    // Click complete button
    const completeButton = this.page.getByRole('button', { name: /selesai|complete|finish/i }).first();
    await completeButton.click();

    // Confirm if modal appears
    await this.page.waitForTimeout(500);
    const confirmButton = this.page.getByRole('button', { name: /ya|yes|confirm|setuju/i });
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }

    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForTableLoad(this.page);
  }

  /**
   * Cancel a session
   */
  async cancelSession(identifier: string, reason?: string) {
    await this.searchSession(identifier);

    // Click cancel button
    const cancelButton = this.page.getByRole('button', { name: /batal|cancel/i }).first();
    await cancelButton.click();

    // Fill cancellation reason if modal appears
    await waitForModal(this.page);
    
    if (reason) {
      const reasonField = this.page.getByLabel(/alasan|reason/i);
      await reasonField.fill(reason);
    }

    // Confirm cancellation
    const confirmButton = this.page.getByRole('button', { name: /ya|yes|confirm/i });
    await confirmButton.click();

    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Assign doctor to session
   */
  async assignDoctor(sessionId: string, doctorName: string) {
    await this.viewSession(sessionId);

    // Click assign doctor button
    const assignButton = this.page.getByRole('button', { name: /assign.*doctor|dokter/i });
    await assignButton.click();

    await waitForModal(this.page);

    // Select doctor
    const doctorSelect = this.page.getByLabel(/dokter|doctor/i);
    await doctorSelect.click();
    await doctorSelect.fill(doctorName);
    await this.page.waitForTimeout(500);
    
    const doctorOption = this.page.getByText(doctorName).first();
    await doctorOption.click();

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Assign nurse to session
   */
  async assignNurse(sessionId: string, nurseName: string) {
    await this.viewSession(sessionId);

    // Click assign nurse button
    const assignButton = this.page.getByRole('button', { name: /assign.*nurse|perawat/i });
    await assignButton.click();

    await waitForModal(this.page);

    // Select nurse
    const nurseSelect = this.page.getByLabel(/perawat|nurse/i);
    await nurseSelect.click();
    await nurseSelect.fill(nurseName);
    await this.page.waitForTimeout(500);
    
    const nurseOption = this.page.getByText(nurseName).first();
    await nurseOption.click();

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Record vital signs for a session
   */
  async recordVitalSigns(sessionId: string, vitals: VitalSigns) {
    await this.viewSession(sessionId);

    // Click record vitals button
    const vitalsButton = this.page.getByRole('button', { name: /vital|tanda.*vital/i });
    await vitalsButton.click();

    await waitForModal(this.page);

    // Fill vital signs
    if (vitals.bloodPressure) {
      await this.page.getByLabel(/tekanan.*darah|blood.*pressure/i).fill(vitals.bloodPressure);
    }

    if (vitals.heartRate) {
      await this.page.getByLabel(/detak.*jantung|heart.*rate/i).fill(vitals.heartRate.toString());
    }

    if (vitals.temperature) {
      await this.page.getByLabel(/suhu|temperature/i).fill(vitals.temperature.toString());
    }

    if (vitals.weight) {
      await this.page.getByLabel(/berat.*badan|weight/i).fill(vitals.weight.toString());
    }

    if (vitals.height) {
      await this.page.getByLabel(/tinggi.*badan|height/i).fill(vitals.height.toString());
    }

    if (vitals.oxygenSaturation) {
      await this.page.getByLabel(/saturasi.*oksigen|oxygen.*saturation|spo2/i).fill(vitals.oxygenSaturation.toString());
    }

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Add diagnosis (ICD code) to session
   */
  async addDiagnosis(sessionId: string, icdCode: string, diagnosisName: string) {
    await this.viewSession(sessionId);

    // Click add diagnosis button
    const diagnosisButton = this.page.getByRole('button', { name: /tambah.*diagnos|add.*diagnos/i });
    await diagnosisButton.click();

    await waitForModal(this.page);

    // Fill ICD code
    const icdField = this.page.getByLabel(/icd|kode.*diagnos/i);
    await icdField.fill(icdCode);

    // Fill diagnosis name
    const nameField = this.page.getByLabel(/nama.*diagnos|diagnosis.*name/i);
    await nameField.fill(diagnosisName);

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Create therapy plan for session
   */
  async createTherapyPlan(sessionId: string, planName: string, items: TherapyPlanItem[]) {
    await this.viewSession(sessionId);

    // Click create therapy plan button
    const planButton = this.page.getByRole('button', { name: /buat.*terapi|create.*therapy.*plan|rencana.*terapi/i });
    await planButton.click();

    await waitForModal(this.page);

    // Fill plan name
    const nameField = this.page.getByLabel(/nama.*rencana|plan.*name/i);
    await nameField.fill(planName);

    // Add items
    for (const item of items) {
      // Click add item button
      const addItemButton = this.page.getByRole('button', { name: /tambah.*item|add.*item/i });
      await addItemButton.click();

      await this.page.waitForTimeout(300);

      // Select product
      const productSelect = this.page.getByLabel(/produk|product|obat/i).last();
      await productSelect.click();
      await productSelect.fill(item.productName);
      await this.page.waitForTimeout(500);
      
      const productOption = this.page.getByText(item.productName).first();
      await productOption.click();

      // Fill quantity
      const quantityField = this.page.getByLabel(/jumlah|quantity/i).last();
      await quantityField.fill(item.quantity.toString());

      // Fill dosage if provided
      if (item.dosage) {
        const dosageField = this.page.getByLabel(/dosis|dosage/i).last();
        await dosageField.fill(item.dosage);
      }

      // Fill frequency if provided
      if (item.frequency) {
        const frequencyField = this.page.getByLabel(/frekuensi|frequency/i).last();
        await frequencyField.fill(item.frequency);
      }

      // Fill duration if provided
      if (item.duration) {
        const durationField = this.page.getByLabel(/durasi|duration/i).last();
        await durationField.fill(item.duration);
      }
    }

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Schedule follow-up session
   */
  async scheduleFollowUp(sessionId: string, followUpDate: string, followUpTime: string) {
    await this.viewSession(sessionId);

    // Click schedule follow-up button
    const followUpButton = this.page.getByRole('button', { name: /jadwal.*lanjutan|schedule.*follow.*up/i });
    await followUpButton.click();

    await waitForModal(this.page);

    // Fill date and time
    await this.page.getByLabel(/tanggal|date/i).fill(followUpDate);
    await this.page.getByLabel(/waktu|time/i).fill(followUpTime);

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Submit current form
   */
  async submitForm() {
    const submitButton = this.page.getByRole('button', { name: /simpan|save|submit|kirim/i });
    await submitButton.click();
  }

  /**
   * Expect session exists in list
   */
  async expectSessionExists(identifier: string) {
    const row = this.page.locator('tr, [role="row"]').filter({ hasText: identifier });
    await expect(row).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expect session not exists in list
   */
  async expectSessionNotExists(identifier: string) {
    const row = this.page.locator('tr, [role="row"]').filter({ hasText: identifier });
    await expect(row).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect session status
   */
  async expectSessionStatus(identifier: string, status: string) {
    await this.searchSession(identifier);
    
    const row = this.page.locator('tr, [role="row"]').filter({ hasText: identifier });
    await expect(row).toContainText(new RegExp(status, 'i'));
  }

  /**
   * Expect doctor assigned
   */
  async expectDoctorAssigned(doctorName: string) {
    const doctorElement = this.page.locator('text=/dokter|doctor/i').locator('..').getByText(doctorName);
    await expect(doctorElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect nurse assigned
   */
  async expectNurseAssigned(nurseName: string) {
    const nurseElement = this.page.locator('text=/perawat|nurse/i').locator('..').getByText(nurseName);
    await expect(nurseElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect vital signs recorded
   */
  async expectVitalSignsRecorded() {
    const vitalsSection = this.page.locator('text=/vital.*sign|tanda.*vital/i');
    await expect(vitalsSection).toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect diagnosis added
   */
  async expectDiagnosisAdded(icdCode: string) {
    const diagnosisElement = this.page.getByText(new RegExp(icdCode, 'i'));
    await expect(diagnosisElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect therapy plan created
   */
  async expectTherapyPlanCreated(planName: string) {
    const planElement = this.page.getByText(new RegExp(planName, 'i'));
    await expect(planElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get session count
   */
  async getSessionCount(): Promise<number> {
    const rows = this.page.locator('tbody tr, [role="row"]').filter({ hasNotText: /tidak.*ada.*data|no.*data|kosong/i });
    return await rows.count();
  }

  /**
   * Filter sessions by status
   */
  async filterByStatus(status: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    const statusOption = this.page.getByLabel(/status/i);
    await statusOption.click();
    
    const option = this.page.getByRole('option', { name: new RegExp(status, 'i') });
    await option.click();

    // Apply filter
    const applyButton = this.page.getByRole('button', { name: /terapkan|apply/i });
    await applyButton.click();

    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Filter sessions by date range
   */
  async filterByDateRange(startDate: string, endDate: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    await this.page.getByLabel(/tanggal.*mulai|start.*date/i).fill(startDate);
    await this.page.getByLabel(/tanggal.*akhir|end.*date/i).fill(endDate);

    // Apply filter
    const applyButton = this.page.getByRole('button', { name: /terapkan|apply/i });
    await applyButton.click();

    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }
}
