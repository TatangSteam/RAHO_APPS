import ExcelJS from 'exceljs';
import { buildExcelImportPayload, importIdentity } from '../zoho.excel-import.policy';
import { assertSafeXlsx, inspectImportWorkbook, previewImportRows, readImportWorkbook } from '../zoho.excel-import.workbook';

function workbookWithRows(rows: ExcelJS.CellValue[][], name = 'Pelanggan') {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet(name).addRows(rows);
  return workbook;
}

describe('Zoho Excel master import workbook', () => {
  it('reads a real XLSX and inspects multiple sheets with a configurable header row', async () => {
    const source = workbookWithRows([['Laporan'], ['Nama', 'Email'], ['Budi', 'budi@example.test']]);
    source.addWorksheet('Vendor').addRows([['Laporan'], ['Nama', 'Alamat'], ['Supplier', 'Jakarta']]);
    const buffer = Buffer.from(await source.xlsx.writeBuffer());
    const imported = await readImportWorkbook(buffer);
    expect(inspectImportWorkbook(imported, 2).sheets).toMatchObject([
      { name: 'Pelanggan', columns: [{ id: '1', label: 'Nama' }, { id: '2', label: 'Email' }] },
      { name: 'Vendor', columns: [{ id: '1', label: 'Nama' }, { id: '2', label: 'Alamat' }] },
    ]);
  });

  it('only reads mapped columns and preserves textual phone numbers', () => {
    const source = workbookWithRows([['Nama', 'Telepon', 'Diagnosis'], [' Budi ', '08123456789', 'Private']]);
    const rows = previewImportRows(source, 1, 1, 'customer', { name: '1', phone: '2' });
    expect(rows).toEqual([{ rowNumber: 2, data: { name: 'Budi', phone: '08123456789' }, errors: [] }]);
    expect(buildExcelImportPayload('customer', { rowNumber: 2, ...rows[0].data, name: 'Budi' })).not.toHaveProperty('Diagnosis');
  });

  it('marks duplicate contacts and invalid emails instead of importing a partial batch', () => {
    const source = workbookWithRows([['Nama', 'Email'], ['Budi', 'budi@example.test'], ['budi', 'wrong']]);
    const rows = previewImportRows(source, 1, 1, 'customer', { name: '1', email: '2' });
    expect(rows[1].errors.join(' ')).toContain('email');
    const duplicate = workbookWithRows([['Nama'], [' Budi '], ['budi']]);
    expect(previewImportRows(duplicate, 1, 1, 'customer', { name: '1' })[1].errors.join(' ')).toContain('duplikat');
  });

  it('rejects formulas and numeric phone cells', () => {
    const source = workbookWithRows([['Nama', 'Telepon'], [{ formula: '"Budi"', result: 'Budi' }, 8123456789]]);
    expect(previewImportRows(source, 1, 1, 'customer', { name: '1', phone: '2' })[0].errors.join(' ')).toMatch(/formula.*Nomor telepon/);
  });

  it('imports products without changing stock or cost layers and rejects ambiguous prices', () => {
    const source = workbookWithRows([['Nama', 'SKU', 'Harga', 'Satuan'], ['Air Nano', 'NANO-1', 35000, 'botol']]);
    const row = previewImportRows(source, 1, 1, 'item', { name: '1', sku: '2', rate: '3', unit: '4' })[0];
    expect(row.errors).toEqual([]);
    const payload = buildExcelImportPayload('item', { rowNumber: 2, name: 'Air Nano', sku: 'NANO-1', rate: 35000, unit: 'botol' });
    expect(payload).toEqual({ name: 'Air Nano', sku: 'NANO-1', rate: 35000, unit: 'botol', product_type: 'goods', item_type: 'sales' });
    source.worksheets[0].getCell('C2').value = '35.000';
    expect(previewImportRows(source, 1, 1, 'item', { name: '1', sku: '2', rate: '3', unit: '4' })[0].errors.join(' ')).toContain('Harga harus');
  });

  it('rejects missing required fields, repeated mapping columns and oversized batches', () => {
    const source = workbookWithRows([['Nama', 'Email'], ['Budi', 'budi@example.test']]);
    expect(() => previewImportRows(source, 1, 1, 'item', { name: '1' })).toThrow('Pilih kolom sku');
    expect(() => previewImportRows(source, 1, 1, 'customer', { name: '1', email: '1' })).toThrow('dua field');
    for (let index = 0; index < 100; index++) source.worksheets[0].addRow([`Nama ${index}`, 'valid@example.test']);
    expect(() => previewImportRows(source, 1, 1, 'customer', { name: '1' })).toThrow('100 baris');
  });

  it('rejects non-XLSX and oversized decompressed ZIP entries before parsing', async () => {
    expect(() => assertSafeXlsx(Buffer.from('not Excel'))).toThrow('valid');
    const buffer = Buffer.from(await workbookWithRows([['Nama']]).xlsx.writeBuffer());
    const central = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    buffer.writeUInt32LE(26 * 1024 * 1024, central + 24);
    expect(() => assertSafeXlsx(buffer)).toThrow('terlalu besar');
  });

  it('uses stable identities independent of file name, row number and optional fields', () => {
    expect(importIdentity('customer', { rowNumber: 2, name: ' Budi ' })).toBe(importIdentity('customer', { rowNumber: 7, name: 'budi', phone: '0812345678' }));
    expect(importIdentity('item', { rowNumber: 2, name: 'Produk', sku: ' NANO-1 ' })).toBe('item:nano-1');
  });
});
