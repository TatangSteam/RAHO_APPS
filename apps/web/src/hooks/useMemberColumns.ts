import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect } from 'react';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean; // Required columns cannot be hidden
  width?: string;
}

// Default column configuration
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'memberNo', label: 'No. Member', visible: true, required: true },
  { id: 'nameAndBranch', label: 'Nama & Cabang', visible: true, required: true },
  { id: 'rank', label: 'Rank Member', visible: true, required: true },
  { id: 'phone', label: 'Telepon', visible: true },
  { id: 'registrationDate', label: 'Tanggal Daftar', visible: false },
  { id: 'email', label: 'Email', visible: false },
  { id: 'age', label: 'Umur', visible: false },
  { id: 'voucherCount', label: 'Voucher Terpakai', visible: false },
  { id: 'basicPackage', label: 'Voucher BASIC', visible: true },
  { id: 'sessionCount', label: 'Jumlah Sesi', visible: false },
  { id: 'lastInfusion', label: 'Terakhir Infus', visible: false },
  { id: 'diagnosis', label: 'Diagnosis Utama', visible: false },
  { id: 'status', label: 'Status', visible: true, required: true },
  { id: 'actions', label: 'Aksi', visible: true, required: true },
];

const STORAGE_KEY = 'raho-member-columns-config';

export function normalizeMemberColumns(savedColumns: ColumnConfig[]): ColumnConfig[] {
  return DEFAULT_COLUMNS.map(defaultColumn => {
    const savedColumn = savedColumns.find(column => column.id === defaultColumn.id);
    const savedVisibility =
      typeof savedColumn?.visible === 'boolean'
        ? savedColumn.visible
        : defaultColumn.visible;

    return {
      ...defaultColumn,
      visible: defaultColumn.required ? true : savedVisibility,
    };
  });
}

export function useMemberColumns() {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedColumns: unknown = JSON.parse(saved);
        if (Array.isArray(savedColumns)) {
          setColumns(normalizeMemberColumns(savedColumns as ColumnConfig[]));
        }
      }
    } catch (error) {
      assertCaughtError(error);
      console.error('Failed to load column config:', error);
    }
  }, []);

  // Save to localStorage when columns change
  const updateColumns = (newColumns: ColumnConfig[]) => {
    const normalizedColumns = normalizeMemberColumns(newColumns);
    setColumns(normalizedColumns);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedColumns));
    } catch (error) {
      assertCaughtError(error);
      console.error('Failed to save column config:', error);
    }
  };

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    const newColumns = columns.map(col =>
      col.id === columnId && !col.required
        ? { ...col, visible: !col.visible }
        : col
    );
    updateColumns(newColumns);
  };

  // Reset to defaults
  const resetColumns = () => {
    updateColumns(DEFAULT_COLUMNS);
  };

  // Get visible columns
  const visibleColumns = columns.filter(col => col.visible);

  return {
    columns,
    visibleColumns,
    toggleColumn,
    resetColumns,
    updateColumns,
  };
}
