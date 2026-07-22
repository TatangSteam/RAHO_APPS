import { z } from 'zod';

const businessDate = (endOfDay: boolean) => z.preprocess((value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`);
  }
  return value;
}, z.coerce.date());

export const financeReportQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  startDate: businessDate(false).optional(),
  endDate: businessDate(true).optional(),
}).refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  path: ['endDate'],
  message: 'Tanggal akhir harus sama atau setelah tanggal mulai.',
});

export const generalLedgerQuerySchema = financeReportQuerySchema.and(z.object({
  accountCode: z.string().trim().min(1).max(30).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
}));

export type FinanceReportQuery = z.infer<typeof financeReportQuerySchema>;
export type GeneralLedgerQuery = z.infer<typeof generalLedgerQuerySchema>;
