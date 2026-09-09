import {
  areAllPurchaseInvoicesPaid,
  calculateChsCoordinatorMonthlyIncentive,
  calculateMsoMonthlyIncentive,
  calculateNakesMonthlyIncentive,
  getJakartaMonthRange,
  getChsQualifierTarget,
  isAirNanoBoxSale,
  isEligiblePaidChsInfusion,
} from '../staff-incentive.service';
import { InvoiceStatus, PaymentVerificationStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import { buildStaffIncentiveWorkbook } from '../staff-incentive-export.service';

describe('staff monthly incentive rules', () => {
  it('pays Nakes Rp10.000 per infusion and a single Rp2.000.000 bonus from 100 infusions', () => {
    expect(calculateNakesMonthlyIncentive(99)).toMatchObject({
      baseAmount: 990_000,
      targetBonus: 0,
      totalAmount: 990_000,
    });
    expect(calculateNakesMonthlyIncentive(100)).toMatchObject({
      baseAmount: 1_000_000,
      targetBonus: 2_000_000,
      totalAmount: 3_000_000,
    });
    expect(calculateNakesMonthlyIncentive(200)).toMatchObject({
      baseAmount: 2_000_000,
      targetBonus: 2_000_000,
      totalAmount: 4_000_000,
    });
  });

  it('requires both 100 visits and 5 paid boxes for the MSO visit bonus', () => {
    expect(calculateMsoMonthlyIncentive(100, 4)).toMatchObject({ visitBonus: 0, airNanoAmount: 360_000 });
    expect(calculateMsoMonthlyIncentive(99, 5)).toMatchObject({ visitBonus: 0, airNanoAmount: 450_000 });
    expect(calculateMsoMonthlyIncentive(100, 5)).toMatchObject({
      visitBonus: 2_000_000,
      airNanoAmount: 450_000,
      totalAmount: 2_450_000,
    });
    expect(calculateMsoMonthlyIncentive(200, 8)).toMatchObject({
      visitBonus: 2_000_000,
      airNanoAmount: 720_000,
      totalAmount: 2_720_000,
    });
  });

  it('uses Jakarta calendar-month boundaries', () => {
    expect(getJakartaMonthRange('2026-09')).toEqual({
      month: '2026-09',
      start: new Date('2026-08-31T17:00:00.000Z'),
      end: new Date('2026-09-30T17:00:00.000Z'),
    });
  });

  it('recognizes canonical and legacy Air Nano box identities', () => {
    expect(isAirNanoBoxSale('PRD-ANN-KNG-003', null)).toBe(true);
    expect(isAirNanoBoxSale('ARN-CK-V06-DS', null)).toBe(true);
    expect(isAirNanoBoxSale(null, 'Air Nano Biru 600ml 1 Dus')).toBe(true);
    expect(isAirNanoBoxSale('PRD-ANN-KNG-001', 'Air Nano 1 Botol')).toBe(false);
  });

  it('requires every active purchase invoice to be paid and verified', () => {
    expect(areAllPurchaseInvoicesPaid([{
      status: InvoiceStatus.PAID,
      paymentVerificationStatus: PaymentVerificationStatus.VERIFIED,
    }])).toBe(true);
    expect(areAllPurchaseInvoicesPaid([
      { status: InvoiceStatus.PAID, paymentVerificationStatus: PaymentVerificationStatus.VERIFIED },
      { status: InvoiceStatus.PENDING_PAYMENT, paymentVerificationStatus: PaymentVerificationStatus.PENDING },
    ])).toBe(false);
    expect(areAllPurchaseInvoicesPaid([{
      status: InvoiceStatus.CANCELLED,
      paymentVerificationStatus: PaymentVerificationStatus.VERIFIED,
    }])).toBe(false);
  });

  it('calculates the coordinator personal-infusion bonus only once', () => {
    expect(calculateChsCoordinatorMonthlyIncentive(400, 110)).toMatchObject({
      paidInfusionAmount: 400_000,
      personalInfusionAmount: 1_100_000,
      personalTargetBonus: 2_000_000,
      totalAmount: 3_500_000,
    });
    expect(calculateChsCoordinatorMonthlyIncentive(0, 200)).toMatchObject({
      personalTargetBonus: 2_000_000,
      totalAmount: 4_000_000,
    });
  });

  it('uses the correct CHS qualifier for team and branch scope', () => {
    expect(getChsQualifierTarget('TEAM', true)).toBe(100);
    expect(getChsQualifierTarget('BRANCH', false)).toBe(200);
    expect(getChsQualifierTarget('BRANCH', true)).toBe(300);
  });

  it('excludes free, social, discount above 40%, unpaid, and refunded CHS infusions', () => {
    const paidInvoice = [{
      status: InvoiceStatus.PAID,
      paymentVerificationStatus: PaymentVerificationStatus.VERIFIED,
    }];
    const eligible = {
      finalPrice: 1_000_000,
      discountPercent: 40,
      socialProgramRequestId: null,
      paymentPlanStatus: 'PAID',
      refundedAt: null,
      invoices: paidInvoice,
    };
    expect(isEligiblePaidChsInfusion(eligible)).toBe(true);
    expect(isEligiblePaidChsInfusion({ ...eligible, finalPrice: 0 })).toBe(false);
    expect(isEligiblePaidChsInfusion({ ...eligible, socialProgramRequestId: 'social-1' })).toBe(false);
    expect(isEligiblePaidChsInfusion({ ...eligible, discountPercent: 40.01 })).toBe(false);
    expect(isEligiblePaidChsInfusion({ ...eligible, paymentPlanStatus: 'PARTIAL' })).toBe(false);
    expect(isEligiblePaidChsInfusion({ ...eligible, refundedAt: new Date() })).toBe(false);
  });

  it('exports valid Excel sheets for Nakes, MSO, and CHS coordinators', async () => {
    const report = {
      period: { month: '2026-09', timezone: 'Asia/Jakarta', start: new Date(), endExclusive: new Date() },
      rules: {
        nakes: { ratePerInfusion: 10_000, target: 100, bonus: 2_000_000 },
        mso: { visitTarget: 100, minimumPaidAirNanoBoxes: 5, visitBonus: 2_000_000, ratePerPaidAirNanoBox: 90_000 },
        coordinator: { ratePerEligiblePaidInfusion: 1_000, homecareTeamTarget: 100, branchWithoutHomecareTarget: 200, branchWithHomecareTarget: 300, ratePerPersonalInfusion: 10_000, personalTarget: 100, personalTargetBonus: 2_000_000 },
      },
      nakes: [{ id: 'n1', fullName: 'Nakes A', email: 'nakes@example.com', staffCode: 'N001', role: 'NURSE', ...calculateNakesMonthlyIncentive(100) }],
      mso: [{ id: 'm1', fullName: 'MSO A', email: 'mso@example.com', staffCode: 'M001', role: 'ADMIN_LAYANAN', ...calculateMsoMonthlyIncentive(100, 8) }],
      coordinators: [{ id: 'c1', fullName: 'Koordinator A', email: 'chs@example.com', staffCode: 'C001', role: 'NURSE', scopes: [{ assignmentId: 'a1', scope: 'TEAM', scopeId: 't1', scopeName: 'Tim HC A', branchId: 'b1', branchName: 'Cabang A', qualifierTarget: 100, totalInfusions: 110, qualifierPassed: true, eligiblePaidInfusions: 80 }], ...calculateChsCoordinatorMonthlyIncentive(80, 110) }],
      summary: { nakesRecipients: 1, nakesTotalAmount: 3_000_000, msoRecipients: 1, msoTotalAmount: 2_720_000, coordinatorRecipients: 1, coordinatorTotalAmount: 3_180_000, grandTotalAmount: 8_900_000 },
    };
    const buffer = await buildStaffIncentiveWorkbook(
      report as unknown as Parameters<typeof buildStaffIncentiveWorkbook>[0],
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Ringkasan', 'NAKES', 'MSO', 'KOORDINATOR CHS', 'DETAIL QUALIFIER CHS']);
    expect(workbook.getWorksheet('NAKES')?.getCell('I2').value).toBe(3_000_000);
    expect(workbook.getWorksheet('MSO')?.getCell('I2').value).toBe(2_720_000);
    expect(workbook.getWorksheet('KOORDINATOR CHS')?.getCell('I2').value).toBe(3_180_000);
  });
});
