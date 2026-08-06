'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState } from 'react';
import { AlertCircle, CheckCircle, FileSpreadsheet, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';

interface ImportIssue {
  rowNumber: number;
  field: string;
  message: string;
  fullName?: string;
  nik?: string | null;
  birthDate?: string | null;
}

interface ImportPreview {
  rowNumber: number;
  fullName: string;
  username: string;
  phone: string | null;
  birthDate?: string | null;
  action?: 'create' | 'update';
}

interface InvalidImportRow {
  rowNumber: number;
  fullName: string;
  nik: string | null;
  birthDate: string | null;
  phone: string | null;
  issues: ImportIssue[];
}

interface ImportDryRunResult {
  counts: {
    rows: number;
    validRows: number;
    invalidRows: number;
    createRows?: number;
    updateRows?: number;
  };
  preview: ImportPreview[];
  invalidRows?: InvalidImportRow[];
  issues: ImportIssue[];
  canImport: boolean;
}

interface ImportedAccount {
  action?: 'created' | 'updated';
  memberId: string;
  memberNo: string;
  fullName: string;
  username?: string;
  password?: string;
}

interface MemberAccountImportPanelProps {
  branchId: string;
  compact?: boolean;
  onImported: () => void;
}

const TEMPLATE_COLUMNS = [
  ['nama_lengkap', 'Ya', 'Budi Santoso', 'Nama lengkap member.'],
  ['tanggal_lahir', 'Ya', '1990-05-21', 'Format disarankan YYYY-MM-DD.'],
  ['no_hp', 'Ya', '081234567890', 'Nomor HP wajib diisi, minimal 10 digit.'],
  ['username', 'Tidak', 'budi.santoso', 'Jika kosong dibuat otomatis dari nama dan nomor unik.'],
  ['password', 'Tidak', 'RahoMember123', 'Jika kosong dibuat otomatis.'],
  ['nik', 'Tidak', '3273010101900001', 'Harus 16 digit dan unik jika diisi.'],
  ['tipe_identitas', 'Tidak', 'NIK', 'Default NIK. Bisa NO_NIK untuk tanpa NIK.'],
  ['tempat_lahir', 'Tidak', 'Bandung', 'Tempat lahir member.'],
  ['jenis_kelamin', 'Tidak', 'L', 'Isi L/P atau Laki-laki/Perempuan.'],
  ['agama', 'Tidak', 'Islam', 'Agama member.'],
  ['email', 'Tidak', 'budi@example.com', 'Data referensi, login tetap pakai username.'],
  ['alamat', 'Tidak', 'Jl. Merdeka No. 10', 'Alamat member.'],
  ['pekerjaan', 'Tidak', 'Wiraswasta', 'Pekerjaan member.'],
  ['status_nikah', 'Tidak', 'Menikah', 'Status pernikahan.'],
  ['kontak_darurat', 'Tidak', 'Siti Santoso', 'Nama kontak darurat.'],
  ['no_hp_kontak_darurat', 'Tidak', '081298765432', 'Nomor kontak darurat.'],
  ['sumber_info_raho', 'Tidak', 'Instagram', 'Sumber informasi RAHO.'],
  ['kode_pos', 'Tidak', '40111', 'Kode pos.'],
  ['kode_referral', 'Tidak', 'REF-001', 'Harus cocok dengan referral aktif.'],
  ['consent_foto', 'Tidak', 'Ya', 'Isi Ya/Tidak. Default Ya.'],
] as const;

export default function MemberAccountImportPanel({
  branchId,
  compact = false,
  onImported,
}: MemberAccountImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportDryRunResult | null>(null);
  const [createdAccounts, setCreatedAccounts] = useState<ImportedAccount[]>([]);
  const [skippedRows, setSkippedRows] = useState<InvalidImportRow[]>([]);
  const hasImportableRows = Boolean(preview && (preview.canImport || preview.counts.validRows > 0));

  const buildFormData = () => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('branchId', branchId);
    return formData;
  };

  const checkFile = async () => {
    const formData = buildFormData();
    if (!formData) {
      showToast.error('Pilih file Excel terlebih dahulu');
      return;
    }

    try {
      setChecking(true);
      setCreatedAccounts([]);
      setSkippedRows([]);
      const response = await api.post('/members/import/accounts/dry-run', formData);
      setPreview(response.data.data);
      showToast.success('File Excel berhasil dicek');
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to validate member account import:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengecek file Excel');
    } finally {
      setChecking(false);
    }
  };

  const importFile = async () => {
    const formData = buildFormData();
    if (!formData || !hasImportableRows) {
      showToast.error('Cek file Excel yang valid terlebih dahulu');
      return;
    }

    try {
      setImporting(true);
      const response = await api.post('/members/import/accounts/execute', formData);
      const data = response.data.data;
      const created = data.created || [];
      const skipped = data.skipped || [];
      setCreatedAccounts(created);
      setSkippedRows(skipped);
      showToast.success(data.message || 'Import akun member berhasil');
      onImported();
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to import member accounts:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal import akun member');
    } finally {
      setImporting(false);
    }
  };

  const exportInvalidRows = () => {
    if (!preview?.invalidRows?.length) {
      showToast.error('Tidak ada data tidak lengkap untuk diexport');
      return;
    }

    const headers = ['baris', 'nama_lengkap', 'nik', 'tanggal_lahir', 'no_hp', 'field_bermasalah', 'masalah'];
    const rows = preview.invalidRows.flatMap((row) => (
      row.issues.map((issue) => [
        row.rowNumber,
        row.fullName,
        row.nik || '',
        row.birthDate || '',
        row.phone || '',
        issue.field,
        issue.message,
      ])
    ));
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `member-import-data-tidak-lengkap-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={compact ? 'w-full' : 'mb-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/50'}>
      {!compact && (
        <div className="mb-4 flex items-center gap-2 text-neutral-900 dark:text-white">
          <FileSpreadsheet size={20} />
          <h3 className="m-0 text-lg font-bold">Import Akun Member Excel</h3>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          id="branch-member-account-import"
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setPreview(null);
            setCreatedAccounts([]);
            setSkippedRows([]);
          }}
        />
        <label
          htmlFor="branch-member-account-import"
          className="inline-flex min-h-10 max-w-[360px] cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          <Upload size={16} />
          <span className="truncate">{file ? file.name : 'Pilih File Excel'}</span>
        </label>

        <button
          type="button"
          onClick={checkFile}
          disabled={!file || checking || importing}
          className="min-h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          {checking ? 'Mengecek...' : 'Cek File'}
        </button>
        <button
          type="button"
          onClick={importFile}
          disabled={!hasImportableRows || checking || importing}
          className="min-h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? 'Mengimport...' : 'Buat Akun'}
        </button>
      </div>

      <details className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
        <summary className="cursor-pointer text-sm font-bold text-neutral-800 dark:text-neutral-100">
          Lihat kolom Excel yang dibaca sistem
        </summary>
        <div className="mt-3">
          <ResultTable
            headers={['Kolom Excel', 'Wajib', 'Contoh', 'Keterangan']}
            rows={TEMPLATE_COLUMNS.map((column) => [...column])}
          />
        </div>
      </details>

      {preview && (
        <div className="mt-4">
          <div className={`mb-3 flex items-center gap-2 text-sm font-bold ${
            hasImportableRows
              ? preview.counts.invalidRows > 0
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {hasImportableRows ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>
              {preview.counts.rows} baris, {preview.counts.validRows} valid, {preview.counts.invalidRows} perlu diperbaiki
              {typeof preview.counts.createRows === 'number' && typeof preview.counts.updateRows === 'number'
                ? ` (${preview.counts.createRows} buat baru, ${preview.counts.updateRows} lengkapi existing)`
                : ''}
            </span>
          </div>

          {preview.issues.length > 0 ? (
            <>
              {hasImportableRows && (
                <p className="mb-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  Baris valid tetap bisa dibuat. Baris yang tidak lengkap akan di-skip dan bisa diexport untuk diperbaiki lalu diimport ulang.
                </p>
              )}
              <div className="mb-3">
                <button
                  type="button"
                  onClick={exportInvalidRows}
                  className="min-h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
                >
                  Export Data Tidak Lengkap
                </button>
              </div>
              <ResultTable
                headers={['Baris', 'Nama', 'NIK', 'Tgl Lahir', 'No HP', 'Masalah']}
                rows={(preview.invalidRows || []).slice(0, 10).map((row) => [
                  row.rowNumber,
                  row.fullName,
                  row.nik || '-',
                  row.birthDate || '-',
                  row.phone || '-',
                  row.issues.map((issue) => `${issue.field}: ${issue.message}`).join(' | '),
                ])}
              />
            </>
          ) : (
            <ResultTable
              headers={['Baris', 'Nama', 'Username', 'No HP', 'Aksi Import']}
              rows={preview.preview.slice(0, 10).map((row) => [
                row.rowNumber,
                row.fullName,
                row.username,
                row.phone || '-',
                row.action === 'update' ? 'Lengkapi Existing' : 'Buat Baru',
              ])}
            />
          )}
        </div>
      )}

      {createdAccounts.length > 0 && (
        <div className="mt-4">
          <ResultTable
            headers={['Aksi', 'Member No', 'Nama', 'Username', 'Password']}
            rows={createdAccounts.map((account) => [
              account.action === 'updated' ? 'Dilengkapi' : 'Dibuat',
              account.memberNo,
              account.fullName,
              account.username || '-',
              account.password || '-',
            ])}
          />
        </div>
      )}

      {skippedRows.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-300">
            <AlertCircle size={16} />
            <span>{skippedRows.length} baris di-skip karena tidak valid</span>
          </div>
          <ResultTable
            headers={['Baris', 'Nama', 'NIK', 'Tgl Lahir', 'No HP', 'Masalah']}
            rows={skippedRows.slice(0, 10).map((row) => [
              row.rowNumber,
              row.fullName,
              row.nik || '-',
              row.birthDate || '-',
              row.phone || '-',
              row.issues.map((issue) => `${issue.field}: ${issue.message}`).join(' | '),
            ])}
          />
        </div>
      )}
    </div>
  );
}

function ResultTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs font-bold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 last:border-b-0 dark:border-neutral-800 dark:text-neutral-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
