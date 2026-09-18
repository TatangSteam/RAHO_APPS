import { createHash } from 'crypto';
import { z } from 'zod';

export const EXCEL_IMPORT_EVENT = 'ZOHO_EXCEL_MASTER_IMPORTED';
export const importTypeSchema = z.enum(['customer', 'vendor', 'item']);
export type ExcelImportType = z.infer<typeof importTypeSchema>;
export const importFields = {
  customer: ['name', 'email', 'phone', 'address'],
  vendor: ['name', 'email', 'phone', 'address'],
  item: ['name', 'sku', 'rate', 'unit'],
} as const;
export const importRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().min(5).max(50).regex(/^[+\d\s().-]+$/).optional(),
  address: z.string().trim().max(500).optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  rate: z.number().finite().min(0).max(1e12).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
}).strict();
export type ExcelImportRow = z.infer<typeof importRowSchema>;

export function importIdentity(type: ExcelImportType, row: ExcelImportRow): string {
  return `${type}:${(type === 'item' ? row.sku || '' : row.name).trim().toLowerCase()}`;
}

export function importHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

// Deliberately whitelist master fields. No diagnosis, therapy, stock, balances or invoices.
export function buildExcelImportPayload(type: ExcelImportType, row: ExcelImportRow) {
  if (type === 'item') {
    if (!row.sku || row.rate === undefined || !row.unit) throw new Error('SKU, harga dan satuan wajib diisi.');
    return { name: row.name, sku: row.sku, rate: row.rate, unit: row.unit, product_type: 'goods', item_type: 'sales' };
  }
  const parts = row.name.split(/\s+/);
  return {
    contact_name: row.name,
    contact_type: type,
    ...(row.address ? { billing_address: { address: row.address } } : {}),
    ...(row.email || row.phone ? { contact_persons: [{
      first_name: parts.shift(), last_name: parts.join(' '),
      ...(row.email ? { email: row.email } : {}),
      ...(row.phone ? { phone: row.phone } : {}),
      is_primary_contact: true,
    }] } : {}),
  };
}
