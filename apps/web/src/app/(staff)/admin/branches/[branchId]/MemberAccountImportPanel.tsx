'use client';

import type { CSSProperties } from 'react';
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
  onImported: () => void;
}

export default function MemberAccountImportPanel({
  branchId,
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
    <div style={{
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      marginBottom: 20,
      background: 'var(--surface-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FileSpreadsheet size={20} />
        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>Import Akun Member Excel</h3>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          id="branch-member-account-import"
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setPreview(null);
            setCreatedAccounts([]);
          }}
        />
        <label
          htmlFor="branch-member-account-import"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 40,
            padding: '0 14px',
            border: '1px dashed var(--surface-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            maxWidth: 360,
          }}
        >
          <Upload size={16} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file ? file.name : 'Pilih File Excel'}
          </span>
        </label>

        <button
          type="button"
          onClick={checkFile}
          disabled={!file || checking || importing}
          style={buttonStyle('secondary', !file || checking || importing)}
        >
          {checking ? 'Mengecek...' : 'Cek File'}
        </button>
        <button
          type="button"
          onClick={importFile}
          disabled={!preview?.canImport || checking || importing}
          style={buttonStyle('primary', !preview?.canImport || checking || importing)}
        >
          {importing ? 'Mengimport...' : 'Buat Akun'}
        </button>
      </div>

      {preview && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: preview.canImport ? 'var(--color-success)' : 'var(--color-danger)',
            fontWeight: 700,
            marginBottom: 12,
          }}>
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
        <div style={{ marginTop: 16 }}>
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
    <div style={{ overflowX: 'auto', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={cellStyle(true)}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={cellStyle(false)}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buttonStyle(type: 'primary' | 'secondary', disabled: boolean): CSSProperties {
  return {
    minHeight: 40,
    padding: '0 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    border: type === 'primary' ? '1px solid transparent' : '1px solid var(--surface-border)',
    background: type === 'primary' ? 'var(--color-primary-500)' : 'var(--surface-hover)',
    color: type === 'primary' ? 'white' : 'var(--text-primary)',
  };
}

function cellStyle(header: boolean): CSSProperties {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid var(--surface-border)',
    textAlign: 'left',
    fontSize: 13,
    color: header ? 'var(--text-secondary)' : 'var(--text-primary)',
    background: header ? 'var(--surface-hover)' : 'transparent',
    fontWeight: header ? 700 : 500,
  };
}
