import {
  areAllPurchaseInvoicesPaid,
  calculateMsoMonthlyIncentive,
  calculateNakesMonthlyIncentive,
  getJakartaMonthRange,
  isAirNanoBoxSale,
} from '../staff-incentive.service';
import { InvoiceStatus, PaymentVerificationStatus } from '@prisma/client';

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
});
