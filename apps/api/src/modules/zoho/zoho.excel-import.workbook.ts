import ExcelJS from 'exceljs';
import { AppError } from '@middleware/errorHandler';
import { buildExcelImportPayload, ExcelImportType, importFields, importIdentity, importRowSchema } from './zoho.excel-import.policy';

export const MAX_IMPORT_ROWS = 100;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const invalid = (message: string) => new AppError(400, 'ZOHO_EXCEL_INVALID', message);

// Check the ZIP directory before ExcelJS expands an XLSX in memory. Reject ZIP64,
// encrypted entries, macros/external links and oversized decompressed workbooks.
export function assertSafeXlsx(buffer: Buffer): void {
  if (buffer.length > MAX_IMPORT_BYTES) throw invalid('File maksimal 5 MB.');
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) { end = offset; break; }
  }
  if (end < 0) throw invalid('Gunakan file Excel .xlsx yang valid, bukan .xls atau file berpassword.');
  const entries = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  let offset = buffer.readUInt32LE(end + 16);
  if (entries > 1500 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)
    || offset + directorySize !== end) throw invalid('Struktur Excel tidak didukung.');
  let expanded = 0;
  let workbookFound = false;
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw invalid('Struktur Excel rusak.');
    const length = buffer.readUInt16LE(offset + 28);
    const next = offset + 46 + length + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
    if (next > end || buffer.readUInt16LE(offset + 8) & 1) throw invalid('Excel terenkripsi tidak didukung.');
    expanded += buffer.readUInt32LE(offset + 24);
    if (expanded > 25 * 1024 * 1024) throw invalid('Isi Excel terlalu besar; pecah menjadi file yang lebih kecil.');
    const name = buffer.subarray(offset + 46, offset + 46 + length).toString('utf8');
    if (/vbaProject|externalLinks/i.test(name)) throw invalid('Gunakan Excel tanpa macro atau tautan workbook eksternal.');
    if (name === 'xl/workbook.xml') workbookFound = true;
    offset = next;
  }
  if (!workbookFound || offset !== end) throw invalid('File bukan workbook .xlsx yang valid.');
}

export async function readImportWorkbook(buffer: Buffer) {
  assertSafeXlsx(buffer);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw invalid('Excel tidak dapat dibaca. Simpan ulang sebagai .xlsx.'); }
  if (workbook.worksheets.length > 50) throw invalid('Maksimal 50 sheet per workbook.');
  return workbook;
}

function cellText(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) {
    throw invalid('Gunakan nilai biasa, bukan formula atau sel error.');
  }
  return cell.text.trim();
}

export function inspectImportWorkbook(workbook: ExcelJS.Workbook, headerRow: number) {
  return { sheets: workbook.worksheets.filter((sheet) => sheet.state === 'visible' && sheet.rowCount >= headerRow).map((sheet) => {
    if (sheet.columnCount > 100) throw invalid('Maksimal 100 kolom per sheet.');
    const columns: Array<{ id: string; label: string }> = [];
    sheet.getRow(headerRow).eachCell((cell, column) => {
      const label = cellText(cell);
      if (label) columns.push({ id: String(column), label: label.slice(0, 100) });
    });
    return { id: sheet.id, name: sheet.name, columns };
  }) };
}

export function previewImportRows(workbook: ExcelJS.Workbook, sheetId: number, headerRow: number, type: ExcelImportType, mapping: Record<string, string>) {
  const sheet = workbook.getWorksheet(sheetId);
  if (!sheet || sheet.state !== 'visible') throw invalid('Sheet tidak ditemukan.');
  const columns = inspectImportWorkbook(workbook, headerRow).sheets.find((entry) => entry.id === sheetId)?.columns || [];
  const fields = importFields[type];
  const required = type === 'item' ? ['name', 'sku', 'rate', 'unit'] : ['name'];
  for (const field of required) if (!mapping[field]) throw invalid(`Pilih kolom ${field}.`);
  for (const [field, column] of Object.entries(mapping)) {
    if (!fields.some((allowed) => allowed === field) || !columns.some((entry) => entry.id === column)) throw invalid('Pemetaan kolom tidak valid.');
  }
  if (new Set(Object.values(mapping)).size !== Object.keys(mapping).length) throw invalid('Satu kolom tidak boleh dipakai untuk dua field.');
  const rows: Array<{ rowNumber: number; data: Record<string, string | number>; errors: string[] }> = [];
  const identities = new Set<string>();
  sheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const data: Record<string, string | number> = {};
    const errors: string[] = [];
    let populated = false;
    for (const [field, column] of Object.entries(mapping)) {
      const cell = excelRow.getCell(Number(column));
      if (cell.value !== null && cell.value !== undefined) populated = true;
      let value = '';
      try { value = cellText(cell); } catch { errors.push(`${field}: salin formula sebagai nilai biasa.`); }
      if (!value) continue;
      if (field === 'phone' && typeof cell.value === 'number') errors.push('Nomor telepon harus berupa teks agar angka 0 di awal tidak hilang.');
      if (field === 'rate') {
        // Never guess Indonesian/English separators in text monetary values.
        if (typeof cell.value !== 'number') errors.push('Harga harus berupa sel angka Excel, bukan teks Rp atau angka dengan pemisah.');
        else data[field] = cell.value;
      } else data[field] = value;
    }
    if (!populated) return;
    if (rows.length >= MAX_IMPORT_ROWS) throw invalid('Maksimal 100 baris data per impor. Pecah file terlebih dahulu.');
    const parsed = importRowSchema.safeParse({ rowNumber, ...data });
    if (!parsed.success) errors.push(...parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
    if (parsed.success) {
      try { buildExcelImportPayload(type, parsed.data); } catch (error) { errors.push((error as Error).message); }
      const identity = importIdentity(type, parsed.data);
      if (identities.has(identity)) errors.push('Nama kontak atau SKU duplikat dalam sheet ini.');
      identities.add(identity);
    }
    rows.push({ rowNumber, data, errors });
  });
  if (!rows.length) throw invalid('Tidak ada baris data pada kolom yang dipilih.');
  return rows;
}
