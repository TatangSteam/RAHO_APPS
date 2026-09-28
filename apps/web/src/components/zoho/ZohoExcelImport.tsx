'use client';

import { useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Info,
  Loader2,
  Package,
  Send,
  TableProperties,
  UploadCloud,
  Users,
} from 'lucide-react';
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
type BusyAction = 'inspect' | 'preview' | 'commit' | 'template' | null;

const fields = {
  name: { label: 'Nama', aliases: ['name', 'nama', 'nama pelanggan', 'nama member', 'member', 'nama vendor', 'nama produk', 'contact_name'] },
  email: { label: 'Email (opsional)', aliases: ['email', 'e-mail'] },
  phone: { label: 'Telepon (opsional, format teks)', aliases: ['phone', 'telepon', 'no hp', 'nomor telepon', 'mobile'] },
  address: { label: 'Alamat (opsional)', aliases: ['address', 'alamat'] },
  sku: { label: 'SKU / kode produk', aliases: ['sku', 'kode produk', 'kode barang'] },
  rate: { label: 'Harga jual (sel angka)', aliases: ['rate', 'harga', 'harga jual'] },
  unit: { label: 'Satuan', aliases: ['unit', 'satuan', 'uom'] },
};

const typeDetails = {
  customer: {
    label: 'Kontak pelanggan',
    description: 'Menambahkan nama pelanggan sebagai kontak customer di Zoho Books.',
    requirement: 'Wajib: nama. Email, telepon, dan alamat boleh dikosongkan.',
    Icon: Users,
  },
  vendor: {
    label: 'Kontak vendor / supplier',
    description: 'Menambahkan pemasok sebagai kontak vendor di Zoho Books.',
    requirement: 'Wajib: nama. Email, telepon, dan alamat boleh dikosongkan.',
    Icon: Building2,
  },
  item: {
    label: 'Produk tanpa stok',
    description: 'Menambahkan item penjualan tanpa pelacakan persediaan.',
    requirement: 'Wajib: nama, SKU, harga jual, dan satuan.',
    Icon: Package,
  },
} as const;

const steps = ['Siapkan file', 'Cocokkan kolom', 'Periksa data', 'Kirim'] as const;
const fieldKeys = (type: ImportType): Array<keyof typeof fields> => type === 'item' ? ['name', 'sku', 'rate', 'unit'] : ['name', 'email', 'phone', 'address'];
const requiredFieldKeys = (type: ImportType) => new Set<keyof typeof fields>(type === 'item' ? ['name', 'sku', 'rate', 'unit'] : ['name']);
const inputClass = 'mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-950 disabled:cursor-not-allowed disabled:opacity-60';

function message(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.error?.message || 'Permintaan gagal. Periksa koneksi lalu coba kembali.';
  return 'File atau data tidak dapat diproses.';
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function StepIndicator({ current }: { current: number }) {
  return (
    <ol aria-label="Tahapan impor" className="grid grid-cols-4 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/50">
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = current > number;
        const active = current === number;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className={`relative flex min-w-0 items-center gap-2 px-2 py-3 sm:px-4 ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-400'}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? 'bg-blue-600 text-white' : complete ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950' : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800'}`}>
              {complete ? <Check size={15} aria-hidden="true" /> : number}
            </span>
            <span className="hidden truncate text-xs font-semibold sm:block">{label}</span>
            {index < steps.length - 1 && <ChevronRight aria-hidden="true" size={15} className="absolute right-0 hidden translate-x-1/2 text-neutral-300 lg:block" />}
          </li>
        );
      })}
    </ol>
  );
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
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState('');
  const busy = busyAction !== null;
  const sheet = sheets.find((entry) => entry.id === sheetId);
  const required = requiredFieldKeys(type);
  const currentStep = result ? 4 : preview ? 3 : sheets.length ? 2 : 1;
  const selectedType = typeDetails[type];
  const SelectedTypeIcon = selectedType.Icon;
  const resetPreview = () => { setPreview(null); setConfirmed(false); setResult(null); setError(''); };

  async function inspect() {
    if (!file) { setError('Pilih file .xlsx terlebih dahulu.'); return; }
    resetPreview(); setBusyAction('inspect'); setSheets([]); setSheetId(null); setMapping({});
    try {
      const form = new FormData(); form.append('file', file); form.append('headerRow', String(headerRow));
      const response = await api.post<{ data: { sheets: Sheet[] } }>('/integrations/zoho/excel-import/inspect', form);
      const loaded = response.data.data.sheets.filter((entry) => entry.columns.length);
      setSheets(loaded); setSheetId(loaded[0]?.id || null); setMapping(suggestImportMapping(type, loaded[0]));
      if (!loaded.length) setError('Kolom tidak ditemukan. Periksa nomor baris judul, lalu baca file lagi.');
    } catch (caught) { setError(message(caught)); }
    finally { setBusyAction(null); }
  }

  async function createPreview() {
    if (!file || !sheetId) return;
    resetPreview(); setBusyAction('preview');
    try {
      const form = new FormData(); form.append('file', file); form.append('headerRow', String(headerRow));
      form.append('type', type); form.append('sheetId', String(sheetId)); form.append('mapping', JSON.stringify(mapping));
      const response = await api.post<{ data: Preview }>('/integrations/zoho/excel-import/preview', form);
      setPreview(response.data.data);
    } catch (caught) { setError(message(caught)); }
    finally { setBusyAction(null); }
  }

  async function commit() {
    if (!preview?.proof || !confirmed || !preview.readyToQueue || preview.errorCount) return;
    setBusyAction('commit'); setError('');
    try {
      const response = await api.post<{ data: Result }>('/integrations/zoho/excel-import/commit', {
        type, rows: preview.normalizedRows, proof: preview.proof, confirmed: true,
      });
      setResult(response.data.data); setConfirmed(false);
    } catch (caught) { setError(message(caught)); }
    finally { setBusyAction(null); }
  }

  async function downloadTemplate() {
    setBusyAction('template'); setError('');
    try {
      const response = await api.get('/integrations/zoho/excel-import/template', { params: { type }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `template-zoho-${type}.xlsx`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) { setError(message(caught)); }
    finally { setBusyAction(null); }
  }

  if (!canManage) return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div><h2 className="font-semibold">Akses impor dibatasi</h2><p className="mt-1 text-sm">Impor Excel hanya dapat dilakukan oleh Super Admin.</p></div>
      </div>
    </section>
  );

  return (
    <section data-testid="zoho-excel-import" className="min-w-0 space-y-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FileSpreadsheet size={23} aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Zoho Books</p>
            <h2 className="mt-1 text-xl font-bold text-neutral-900 dark:text-white">Impor master dari Excel</h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">Ikuti empat tahap berikut. Data belum dikirim ke Zoho sampai Anda melihat pratinjau dan mencentang konfirmasi.</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 size={14} aria-hidden="true" /> Aman sampai tahap konfirmasi</span>
      </header>

      <StepIndicator current={currentStep} />

      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex items-start gap-3"><Info className="mt-0.5 shrink-0" size={18} aria-hidden="true" /><div><p className="font-semibold">Yang dapat diimpor hanya master baru</p><p className="mt-1 text-amber-800/90 dark:text-amber-200/80">Kontak pelanggan, vendor, atau produk tanpa stok. Invoice, pembayaran, saldo awal, stok, dan transaksi terapi tidak akan dibuat. Data yang sudah ada di Zoho juga tidak ditimpa.</p></div></div>
      </div>

      <div className="space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800 md:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">1</span>
          <div><h3 className="font-semibold">Siapkan file Excel</h3><p className="text-sm text-neutral-500">Tentukan jenis data, lalu pilih file yang akan diperiksa.</p></div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <label className="block text-sm font-semibold">Jenis data
              <select aria-label="Jenis data" disabled={busy} value={type} className={inputClass} onChange={(event) => {
                const next = event.target.value as ImportType; setType(next); setMapping(suggestImportMapping(next, sheet)); resetPreview();
              }}><option value="customer">Kontak pelanggan</option><option value="vendor">Kontak vendor / supplier</option><option value="item">Produk (tanpa stok)</option></select>
            </label>

            <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/25">
              <SelectedTypeIcon size={20} className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
              <div><p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{selectedType.label}</p><p className="mt-1 text-sm text-blue-800/80 dark:text-blue-200/80">{selectedType.description}</p><p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300">{selectedType.requirement}</p></div>
            </div>

            <label className={`group block cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition ${file ? 'border-blue-400 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20' : 'border-neutral-300 hover:border-blue-400 hover:bg-blue-50/40 dark:border-neutral-700 dark:hover:border-blue-700'}`}>
              <input aria-label="File Excel" type="file" accept=".xlsx" disabled={busy} className="sr-only" onChange={(event) => {
                setFile(event.target.files?.[0] || null); setSheets([]); setSheetId(null); setMapping({}); resetPreview();
              }} />
              <UploadCloud className="mx-auto text-blue-600" size={30} aria-hidden="true" />
              {file ? <><span className="mt-2 block break-all text-sm font-semibold text-neutral-900 dark:text-white">{file.name}</span><span className="mt-1 block text-xs text-neutral-500">{fileSize(file.size)} · klik untuk mengganti file</span></> : <><span className="mt-2 block text-sm font-semibold">Pilih file Excel</span><span className="mt-1 block text-xs text-neutral-500">Format .xlsx · maksimal 5 MB</span></>}
            </label>

            <label className="block max-w-xs text-sm font-semibold">Baris judul kolom
              <input aria-label="Nomor baris judul kolom" type="number" min={1} max={100} disabled={busy} value={headerRow} className={inputClass} onChange={(event) => {
                setHeaderRow(Number(event.target.value)); setSheets([]); setSheetId(null); setMapping({}); resetPreview();
              }} /><span className="mt-1.5 block text-xs font-normal text-neutral-500">Biasanya baris 1. Isi 5 jika judul seperti “Nama” atau “Email” berada di baris kelima.</span>
            </label>
          </div>

          <aside className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/50">
            <h4 className="text-sm font-semibold">Sebelum membaca file</h4>
            <ul className="mt-3 space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
              {['Maksimal 100 baris data per proses', 'Tidak memakai formula pada kolom yang dipilih', 'Nomor telepon disimpan sebagai teks', 'Nama kontak atau SKU tidak duplikat'].map((item) => <li key={item} className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{item}</li>)}
            </ul>
            <button type="button" disabled={busy} onClick={downloadTemplate} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
              {busyAction === 'template' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Unduh template
            </button>
          </aside>
        </div>

        <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">Membaca file hanya menampilkan sheet dan kolom. Belum ada data yang dikirim.</p>
          <button type="button" disabled={busy || !file || headerRow < 1 || headerRow > 100} onClick={inspect} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {busyAction === 'inspect' ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <TableProperties size={17} aria-hidden="true" />} {busyAction === 'inspect' ? 'Membaca file…' : 'Baca file Excel'}
          </button>
        </div>
      </div>

      {sheets.length > 0 && <div className="space-y-5 rounded-2xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-900 dark:bg-blue-950/10 md:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">2</span>
          <div><h3 className="font-semibold">Cocokkan kolom Excel</h3><p className="text-sm text-neutral-500">Pilih satu sheet, lalu tentukan kolom sumber untuk setiap field Zoho.</p></div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold">Sheet yang akan diimpor
            <select aria-label="Sheet yang akan diimpor" value={sheetId || ''} disabled={busy} className={inputClass} onChange={(event) => {
              const id = Number(event.target.value); setSheetId(id); setMapping(suggestImportMapping(type, sheets.find((entry) => entry.id === id))); resetPreview();
            }}>{sheets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
          </label>
          <div className="rounded-xl border border-blue-200 bg-white p-3 text-sm dark:border-blue-900 dark:bg-neutral-900">
            <p className="font-semibold">{sheet?.columns.length || 0} kolom ditemukan</p>
            <p className="mt-1 text-xs text-neutral-500">Sistem menyarankan kecocokan dari nama kolom. Tetap periksa sebelum melanjutkan.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="hidden grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-4 border-b bg-neutral-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50 md:grid"><span>Field tujuan Zoho</span><span>Kolom dari Excel</span></div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">{fieldKeys(type).map((field) => <div key={field} className="grid items-center gap-2 p-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:gap-4">
            <div><p className="text-sm font-semibold">{fields[field].label}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${required.has(field) ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>{required.has(field) ? 'Wajib' : 'Opsional'}</span></div>
            <select aria-label={fields[field].label} value={mapping[field] || ''} disabled={busy} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-950" onChange={(event) => {
              const next = { ...mapping }; if (event.target.value) next[field] = event.target.value; else delete next[field]; setMapping(next); resetPreview();
            }}><option value="">{required.has(field) ? 'Pilih kolom Excel' : 'Tidak dipakai'}</option>{sheet?.columns.map((column) => <option key={column.id} value={column.id}>{column.label} · kolom {column.id}</option>)}</select>
          </div>)}</div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">Pratinjau memvalidasi seluruh baris tanpa mengirimnya ke Zoho.</p>
          <button type="button" disabled={busy || !mapping.name || (type === 'item' && (!mapping.sku || !mapping.rate || !mapping.unit))} onClick={createPreview} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {busyAction === 'preview' ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />} {busyAction === 'preview' ? 'Memeriksa data…' : 'Lihat pratinjau'}
          </button>
        </div>
      </div>}

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300"><AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" /><div><p className="font-semibold">File belum dapat diproses</p><p className="mt-1">{error}</p></div></div>}

      {preview && <div className="space-y-5 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800 md:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">3</span>
          <div><h3 className="font-semibold">Periksa data sebelum dikirim</h3><p className="text-sm text-neutral-500">Pastikan jumlah baris, tujuan, dan isi data sudah sesuai.</p></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Tujuan</p><p className="mt-2 truncate font-semibold">{preview.organization?.name || 'Belum terhubung'}</p>{preview.organization && <p className="mt-1 truncate text-xs text-neutral-500">ID {preview.organization.id}</p>}</div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Siap</p><p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{preview.validCount}</p><p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">baris valid</p></div>
          <div className={`rounded-xl border p-4 ${preview.errorCount ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/40'}`}><p className={`text-xs font-semibold uppercase tracking-wide ${preview.errorCount ? 'text-red-700 dark:text-red-300' : 'text-neutral-500'}`}>Perlu diperbaiki</p><p className={`mt-2 text-2xl font-bold ${preview.errorCount ? 'text-red-700 dark:text-red-300' : 'text-neutral-700 dark:text-neutral-300'}`}>{preview.errorCount}</p><p className="text-xs text-neutral-500">baris bermasalah</p></div>
        </div>

        <div className={`rounded-xl border p-4 text-sm ${preview.readyToQueue && !preview.errorCount ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200'}`}>
          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">Status pengiriman</span><span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold dark:bg-neutral-900">Mode {preview.mode}</span></div><p className="mt-2">{preview.message}</p>
        </div>

        <div className="max-h-[28rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800"><table className="min-w-[720px] w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-950"><tr><th className="p-3">Baris</th>{fieldKeys(type).map((field) => <th key={field} className="p-3">{fields[field].label}</th>)}<th className="p-3">Validasi</th></tr></thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">{preview.rows.map((row) => <tr key={row.rowNumber} className={row.errors.length ? 'bg-red-50/60 dark:bg-red-950/10' : ''}><td className="p-3 font-medium">{row.rowNumber}</td>{fieldKeys(type).map((field) => <td key={field} className="max-w-xs break-words p-3">{row.data[field] ?? '—'}</td>)}<td className={`p-3 ${row.errors.length ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{row.errors.length ? row.errors.join(' · ') : <span className="inline-flex items-center gap-1"><CheckCircle2 size={15} aria-hidden="true" /> Valid</span>}</td></tr>)}</tbody>
        </table></div>

        {preview.errorCount > 0 && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300"><AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Perbaiki Excel sebelum melanjutkan</p><p className="mt-1">Perbaiki baris merah, pilih ulang file, lalu buat pratinjau lagi. Seluruh batch ditahan dan tidak ada data yang dikirim.</p></div></div>}

        {!result && preview.readyToQueue && preview.proof && preview.errorCount === 0 && <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">4</span><div><h3 className="font-semibold">Konfirmasi dan kirim</h3><p className="text-sm text-neutral-500">Tindakan berikut akan memasukkan data ke antrean Zoho.</p></div></div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-white p-4 text-sm dark:border-blue-900 dark:bg-neutral-900"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-blue-600" /><span><strong>Saya sudah memeriksa data dan organisasi tujuan.</strong><span className="mt-1 block text-neutral-500">Saya ingin menambahkan {preview.validCount} master ini ke Zoho Books.</span></span></label>
          <div className="mt-4 flex justify-end"><button type="button" disabled={busy || !confirmed} onClick={commit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busyAction === 'commit' ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />} {busyAction === 'commit' ? 'Memasukkan ke antrean…' : 'Kirim ke antrean Zoho'}</button></div>
        </div>}
      </div>}

      {result && <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
        <div className="flex items-start gap-3"><CheckCircle2 size={24} className="mt-0.5 shrink-0" aria-hidden="true" /><div><h3 className="font-semibold">Data berhasil masuk antrean</h3><p className="mt-1 text-sm">{result.queued} baris baru masuk antrean; {result.alreadyQueued} baris sudah pernah diantrekan.</p><p className="mt-2 text-sm text-emerald-800/80 dark:text-emerald-200/80">Ini belum berarti data sudah tersimpan di Zoho. Pantau hasil worker: CREATED berarti dibuat, sedangkan SKIPPED_EXISTING berarti data sudah ada dan dilewati.</p><button type="button" onClick={onViewQueue} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Lihat antrean impor <ChevronRight size={16} aria-hidden="true" /></button></div></div>
      </div>}
    </section>
  );
}
