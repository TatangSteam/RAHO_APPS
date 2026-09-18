'use client';

import { useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';

type ImportType = 'customer' | 'vendor' | 'item';
type ImportRow = { rowNumber: number; name: string; email?: string; phone?: string; address?: string; sku?: string; rate?: number; unit?: string };
type Sheet = { id: number; name: string; columns: Array<{ id: string; label: string }> };
type Preview = {
  rows: Array<{ rowNumber: number; data: Record<string, string | number>; errors: string[] }>;
  normalizedRows: ImportRow[]; validCount: number; errorCount: number; proof: string | null;
  organization: { id: string; name: string } | null; mode: string; readyToQueue: boolean; message: string;
};
type Result = { queued: number; alreadyQueued: number; events: Array<{ id: string; status: string }> };
const fields = {
  name: { label: 'Nama', aliases: ['name', 'nama', 'nama pelanggan', 'nama vendor', 'nama produk', 'contact_name'] },
  email: { label: 'Email (opsional)', aliases: ['email', 'e-mail'] },
  phone: { label: 'Telepon (opsional, format teks)', aliases: ['phone', 'telepon', 'no hp', 'nomor telepon', 'mobile'] },
  address: { label: 'Alamat (opsional)', aliases: ['address', 'alamat'] },
  sku: { label: 'SKU / kode produk', aliases: ['sku', 'kode produk', 'kode barang'] },
  rate: { label: 'Harga jual (sel angka)', aliases: ['rate', 'harga', 'harga jual'] },
  unit: { label: 'Satuan', aliases: ['unit', 'satuan', 'uom'] },
};
const fieldKeys = (type: ImportType): Array<keyof typeof fields> => type === 'item' ? ['name', 'sku', 'rate', 'unit'] : ['name', 'email', 'phone', 'address'];
const inputClass = 'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 disabled:opacity-50';

function message(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.error?.message || 'Permintaan gagal. Periksa koneksi lalu coba kembali.';
  return 'File atau data tidak dapat diproses.';
}

export function suggestImportMapping(type: ImportType, sheet?: Sheet) {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of fieldKeys(type)) {
    const column = sheet?.columns.find((entry) => !used.has(entry.id) && fields[field].aliases.includes(entry.label.trim().toLowerCase()));
    if (column) { mapping[field] = column.id; used.add(column.id); }
  }
  return mapping;
}

export function ZohoExcelImport({ canManage, onViewQueue }: { canManage: boolean; onViewQueue: () => void }) {
  const [type, setType] = useState<ImportType>('customer');
  const [file, setFile] = useState<File | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sheet = sheets.find((entry) => entry.id === sheetId);
  const resetPreview = () => { setPreview(null); setConfirmed(false); setResult(null); setError(''); };

  async function inspect() {
    if (!file) { setError('Pilih file .xlsx terlebih dahulu.'); return; }
    resetPreview(); setBusy(true); setSheets([]); setSheetId(null); setMapping({});
    try {
      const form = new FormData(); form.append('file', file); form.append('headerRow', String(headerRow));
      const response = await api.post<{ data: { sheets: Sheet[] } }>('/integrations/zoho/excel-import/inspect', form);
      const loaded = response.data.data.sheets.filter((entry) => entry.columns.length);
      setSheets(loaded); setSheetId(loaded[0]?.id || null); setMapping(suggestImportMapping(type, loaded[0]));
      if (!loaded.length) setError('Kolom tidak ditemukan. Periksa nomor baris judul, lalu klik Baca sheet lagi.');
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  async function createPreview() {
    if (!file || !sheetId) return;
    resetPreview(); setBusy(true);
    try {
      const form = new FormData(); form.append('file', file); form.append('headerRow', String(headerRow));
      form.append('type', type); form.append('sheetId', String(sheetId)); form.append('mapping', JSON.stringify(mapping));
      const response = await api.post<{ data: Preview }>('/integrations/zoho/excel-import/preview', form);
      setPreview(response.data.data);
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!preview?.proof || !confirmed || !preview.readyToQueue || preview.errorCount) return;
    setBusy(true); setError('');
    try {
      const response = await api.post<{ data: Result }>('/integrations/zoho/excel-import/commit', {
        type, rows: preview.normalizedRows, proof: preview.proof, confirmed: true,
      });
      setResult(response.data.data); setConfirmed(false);
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  async function downloadTemplate() {
    setBusy(true); setError('');
    try {
      const response = await api.get('/integrations/zoho/excel-import/template', { params: { type }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `template-zoho-${type}.xlsx`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  if (!canManage) return <section className="rounded-xl border p-5">Impor Excel hanya dapat dilakukan oleh Super Admin.</section>;
  return (
    <section className="min-w-0 space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
      <div>
        <h2 className="text-lg font-semibold">Impor Excel ke Zoho Books</h2>
        <p className="mt-2 text-sm text-neutral-500">1. Pilih jenis data dan file → 2. Pilih sheet dan kolom → 3. Periksa → 4. Kirim ke antrean.</p>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Hanya menambah master kontak atau produk. Tidak membuat akun member ERP, invoice, saldo awal, stok, maupun transaksi terapi. Data yang sudah ada di Zoho tidak ditimpa.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">Jenis data
          <select aria-label="Jenis data" disabled={busy} value={type} className={inputClass} onChange={(event) => {
            const next = event.target.value as ImportType; setType(next); setMapping(suggestImportMapping(next, sheet)); resetPreview();
          }}><option value="customer">Kontak pelanggan</option><option value="vendor">Kontak vendor / supplier</option><option value="item">Produk (tanpa stok)</option></select>
        </label>
        <div className="self-end"><button type="button" disabled={busy} onClick={downloadTemplate} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Unduh template Excel</button></div>
        <label className="text-sm font-medium">File Excel (.xlsx, maksimal 5 MB dan 100 baris data)
          <input aria-label="File Excel" type="file" accept=".xlsx" disabled={busy} className={inputClass} onChange={(event) => {
            setFile(event.target.files?.[0] || null); setSheets([]); setSheetId(null); setMapping({}); resetPreview();
          }} />
        </label>
        <label className="text-sm font-medium">Nomor baris judul kolom
          <input aria-label="Nomor baris judul kolom" type="number" min={1} max={100} disabled={busy} value={headerRow} className={inputClass} onChange={(event) => {
            setHeaderRow(Number(event.target.value)); setSheets([]); setSheetId(null); setMapping({}); resetPreview();
          }} /><span className="mt-1 block text-xs text-neutral-500">Biasanya 1. Jika judul kolom ada di baris 5, isi 5.</span>
        </label>
      </div>
      <button type="button" disabled={busy || !file || headerRow < 1 || headerRow > 100} onClick={inspect} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Memproses…' : 'Baca sheet'}</button>
      {sheets.length > 0 && <>
        <label className="block text-sm font-medium">Sheet yang akan diimpor
          <select aria-label="Sheet yang akan diimpor" value={sheetId || ''} disabled={busy} className={inputClass} onChange={(event) => {
            const id = Number(event.target.value); setSheetId(id); setMapping(suggestImportMapping(type, sheets.find((entry) => entry.id === id))); resetPreview();
          }}>{sheets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
        </label>
        <div className="grid gap-4 md:grid-cols-2">{fieldKeys(type).map((field) => <label key={field} className="text-sm font-medium">{fields[field].label}
          <select aria-label={fields[field].label} value={mapping[field] || ''} disabled={busy} className={inputClass} onChange={(event) => {
            const next = { ...mapping }; if (event.target.value) next[field] = event.target.value; else delete next[field]; setMapping(next); resetPreview();
          }}><option value="">Pilih kolom / tidak dipakai</option>{sheet?.columns.map((column) => <option key={column.id} value={column.id}>{column.label} (kolom {column.id})</option>)}</select>
        </label>)}</div>
        <button type="button" disabled={busy || !mapping.name || (type === 'item' && (!mapping.sku || !mapping.rate || !mapping.unit))} onClick={createPreview} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Lihat pratinjau</button>
      </>}
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {preview && <div className="space-y-4">
        <div className="rounded-lg border p-3 text-sm">
          <p><strong>Tujuan:</strong> {preview.organization?.name || 'Belum terhubung'} {preview.organization ? `(${preview.organization.id})` : ''}</p>
          <p className="mt-1">{preview.validCount} baris valid · {preview.errorCount} baris perlu diperbaiki · Mode {preview.mode}</p>
          <p className="mt-2">{preview.message}</p>
        </div>
        <div className="max-h-96 overflow-auto rounded-lg border"><table className="w-full text-left text-sm">
          <thead><tr><th className="p-3">Baris</th>{fieldKeys(type).map((field) => <th key={field} className="p-3">{fields[field].label}</th>)}<th className="p-3">Validasi</th></tr></thead>
          <tbody>{preview.rows.map((row) => <tr key={row.rowNumber} className="border-t"><td className="p-3">{row.rowNumber}</td>{fieldKeys(type).map((field) => <td key={field} className="max-w-xs break-words p-3">{row.data[field] ?? '—'}</td>)}<td className={`p-3 ${row.errors.length ? 'text-red-600' : 'text-green-600'}`}>{row.errors.length ? row.errors.join(' · ') : 'Valid; duplikat Zoho dicek saat diproses'}</td></tr>)}</tbody>
        </table></div>
        {preview.errorCount > 0 && <p className="text-sm text-red-600">Perbaiki baris yang ditandai di Excel, pilih ulang file, lalu buat pratinjau lagi. Tidak ada data yang dikirim.</p>}
        {!result && preview.readyToQueue && preview.proof && preview.errorCount === 0 && <>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />Saya sudah memeriksa data dan organisasi tujuan. Saya ingin menambah master ini ke Zoho Books.</label>
          <button type="button" disabled={busy || !confirmed} onClick={commit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Memasukkan ke antrean…' : 'Kirim ke antrean Zoho'}</button>
        </>}
      </div>}
      {result && <div role="status" className="rounded-lg border border-green-300 p-4 text-sm">
        <p>{result.queued} baris baru masuk antrean; {result.alreadyQueued} baris sudah pernah diantrekan.</p>
        <p className="mt-2">Ini belum berarti data sudah tersimpan di Zoho. Lihat hasil worker pada Antrean Sinkronisasi: PROCESSED berarti diproses; FAILED / DEAD_LETTER perlu diperiksa. Detail hasil membedakan CREATED dan SKIPPED_EXISTING.</p>
        <button type="button" onClick={onViewQueue} className="mt-3 font-semibold text-blue-600">Lihat antrean impor</button>
      </div>}
    </section>
  );
}
