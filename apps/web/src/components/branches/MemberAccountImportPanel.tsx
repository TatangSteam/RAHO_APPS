'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, FileSpreadsheet, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';

interface ImportIssue {
  rowNumber: number;
  field: string;
  message: string;
}

interface ImportPreview {
  rowNumber: number;
  fullName: string;
  username: string;
  phone: string;
}

interface ImportDryRunResult {
  counts: {
    rows: number;
    validRows: number;
    invalidRows: number;
  };
  preview: ImportPreview[];
  issues: ImportIssue[];
  canImport: boolean;
}

interface ImportedAccount {
  memberId: string;
  memberNo: string;
  fullName: string;
  username: string;
  password: string;
}

interface MemberAccountImportPanelProps {
  branchId: string;
  compact?: boolean;
  onImported: () => void;
}

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
      const response = await api.post('/members/import/accounts/dry-run', formData);
      setPreview(response.data.data);
      showToast.success('File Excel berhasil dicek');
    } catch (error: any) {
      devError('Failed to validate member account import:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengecek file Excel');
    } finally {
      setChecking(false);
    }
  };

  const importFile = async () => {
    const formData = buildFormData();
    if (!formData || !preview?.canImport) {
      showToast.error('Cek file Excel yang valid terlebih dahulu');
      return;
    }

    try {
      setImporting(true);
      const response = await api.post('/members/import/accounts/execute', formData);
      const created = response.data.data.created || [];
      setCreatedAccounts(created);
      showToast.success(response.data.data.message || 'Import akun member berhasil');
      onImported();
    } catch (error: any) {
      devError('Failed to import member accounts:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal import akun member');
    } finally {
      setImporting(false);
    }
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
          disabled={!preview?.canImport || checking || importing}
          className="min-h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? 'Mengimport...' : 'Buat Akun'}
        </button>
      </div>

      {preview && (
        <div className="mt-4">
          <div className={`mb-3 flex items-center gap-2 text-sm font-bold ${preview.canImport ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {preview.canImport ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>
              {preview.counts.rows} baris, {preview.counts.validRows} valid, {preview.counts.invalidRows} perlu diperbaiki
            </span>
          </div>

          {preview.issues.length > 0 ? (
            <ResultTable
              headers={['Baris', 'Field', 'Masalah']}
              rows={preview.issues.slice(0, 10).map((issue) => [
                issue.rowNumber,
                issue.field,
                issue.message,
              ])}
            />
          ) : (
            <ResultTable
              headers={['Baris', 'Nama', 'Username', 'No HP']}
              rows={preview.preview.slice(0, 10).map((row) => [
                row.rowNumber,
                row.fullName,
                row.username,
                row.phone,
              ])}
            />
          )}
        </div>
      )}

      {createdAccounts.length > 0 && (
        <div className="mt-4">
          <ResultTable
            headers={['Member No', 'Nama', 'Username', 'Password']}
            rows={createdAccounts.map((account) => [
              account.memberNo,
              account.fullName,
              account.username,
              account.password,
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
