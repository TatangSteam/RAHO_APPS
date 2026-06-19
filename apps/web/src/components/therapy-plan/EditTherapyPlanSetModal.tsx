'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TherapyPlan, therapyPlanApi, BulkEditTherapyPlanSetInput } from '@/lib/therapyPlanApi';
import { showToast } from '../ui/Toast';

interface EditTherapyPlanSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  therapyPlans: TherapyPlan[]; // All plans in the set
  onSuccess: () => void;
}

interface EditableRow {
  planNumber: number;
  keterangan: string;
  ifa250: number | null;
  ifa500: number | null;
  hho: number | null;
  h2: number | null;
  no: number | null;
  gaso: number | null;
  o2: number | null;
  o3: number | null;
  edta: number | null;
  mb: number | null;
  h2s: number | null;
  kcl: number | null;
  jmlNb: number | null;
}

export default function EditTherapyPlanSetModal({
  isOpen,
  onClose,
  memberId,
  therapyPlans,
  onSuccess,
}: EditTherapyPlanSetModalProps) {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize rows from therapy plans
  useEffect(() => {
    if (isOpen && therapyPlans.length > 0) {
      const initialRows: EditableRow[] = therapyPlans
        .sort((a, b) => (a.planNumber || 0) - (b.planNumber || 0))
        .map((plan) => ({
          planNumber: plan.planNumber || 0,
          keterangan: plan.keterangan || '',
          ifa250: plan.ifa250 ?? null,
          ifa500: plan.ifa500 ?? null,
          hho: plan.hho ?? null,
          h2: plan.h2 ?? null,
          no: plan.no ?? null,
          gaso: plan.gaso ?? null,
          o2: plan.o2 ?? null,
          o3: plan.o3 ?? null,
          edta: plan.edta ?? null,
          mb: plan.mb ?? null,
          h2s: plan.h2s ?? null,
          kcl: plan.kcl ?? null,
          jmlNb: plan.jmlNb ?? null,
        }));
      setRows(initialRows);
    }
  }, [isOpen, therapyPlans]);

  if (!isOpen || !mounted) return null;

  const setCode = therapyPlans[0]?.setCode || '';
  const setName = therapyPlans[0]?.setName || '';
  const setId = therapyPlans[0]?.therapyPlanSetId || '';

  const handleInputChange = (index: number, field: keyof EditableRow, value: string) => {
    const newRows = [...rows];
    if (field === 'keterangan') {
      newRows[index][field] = value;
    } else {
      const numValue = value === '' ? null : parseFloat(value);
      newRows[index][field as keyof Omit<EditableRow, 'planNumber' | 'keterangan'>] = (isNaN(numValue as number) ? null : numValue) as any;
    }
    setRows(newRows);
  };

  const validateRow = (row: EditableRow): string | null => {
    // Check if at least one dose field is filled
    const hasDose = !!(
      row.ifa250 || row.ifa500 || row.hho || row.h2 || row.no ||
      row.gaso || row.o2 || row.o3 || row.edta || row.mb ||
      row.h2s || row.kcl || row.jmlNb
    );

    if (!hasDose) {
      return `Row ${row.planNumber}: Minimal satu field dosis harus diisi`;
    }

    // Check IFA mutual exclusivity
    if (row.ifa250 && row.ifa500) {
      return `Row ${row.planNumber}: IFA 250ml dan IFA 500ml tidak boleh diisi bersamaan`;
    }

    return null;
  };

  const handleSubmit = async () => {
    // Validate all rows
    for (const row of rows) {
      const error = validateRow(row);
      if (error) {
        showToast.error(error);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: BulkEditTherapyPlanSetInput = {
        plans: rows.map(row => ({
          planNumber: row.planNumber,
          keterangan: row.keterangan,
          ifa250: row.ifa250,
          ifa500: row.ifa500,
          hho: row.hho,
          h2: row.h2,
          no: row.no,
          gaso: row.gaso,
          o2: row.o2,
          o3: row.o3,
          edta: row.edta,
          mb: row.mb,
          h2s: row.h2s,
          kcl: row.kcl,
          jmlNb: row.jmlNb,
        })),
      };

      const response = await therapyPlanApi.bulkEditTherapyPlanSet(memberId, setId, payload);
      
      showToast.success(
        `Berhasil mengedit set therapy plan. ${response.data.editedPlans} dari ${response.data.totalPlans} plan diedit. Versi baru: ${response.data.version}`
      );
      
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Gagal mengedit therapy plan set';
      showToast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
        <div
          className="relative w-full max-w-7xl flex flex-col bg-white dark:bg-neutral-900 shadow-2xl transform transition-all rounded-2xl max-h-[92vh]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Edit Therapy Plan Set</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {setCode} {setName && `- ${setName}`} ({rows.length} plans)
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table Container - Scrollable */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700 border border-neutral-200 dark:border-neutral-700">
              <thead className="bg-neutral-50 dark:bg-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">Keterangan</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">IFA 250</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">IFA 500</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">HHO</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">H2</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">NO</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">GASO</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">O2</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">O3</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">EDTA</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">MB</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">H2S</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase border-r border-neutral-200 dark:border-neutral-700">KCl</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase">Jml NB</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
                {rows.map((row, index) => (
                  <tr key={row.planNumber} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="px-3 py-2 text-sm text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-700 font-medium">{row.planNumber}</td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="text"
                        value={row.keterangan}
                        onChange={(e) => handleInputChange(index, 'keterangan', e.target.value)}
                        className="w-32 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="Keterangan"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.ifa250 ?? ''}
                        onChange={(e) => handleInputChange(index, 'ifa250', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.ifa500 ?? ''}
                        onChange={(e) => handleInputChange(index, 'ifa500', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.hho ?? ''}
                        onChange={(e) => handleInputChange(index, 'hho', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.h2 ?? ''}
                        onChange={(e) => handleInputChange(index, 'h2', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.no ?? ''}
                        onChange={(e) => handleInputChange(index, 'no', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.gaso ?? ''}
                        onChange={(e) => handleInputChange(index, 'gaso', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.o2 ?? ''}
                        onChange={(e) => handleInputChange(index, 'o2', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.o3 ?? ''}
                        onChange={(e) => handleInputChange(index, 'o3', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.edta ?? ''}
                        onChange={(e) => handleInputChange(index, 'edta', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.mb ?? ''}
                        onChange={(e) => handleInputChange(index, 'mb', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.h2s ?? ''}
                        onChange={(e) => handleInputChange(index, 'h2s', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.kcl ?? ''}
                        onChange={(e) => handleInputChange(index, 'kcl', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.jmlNb ?? ''}
                        onChange={(e) => handleInputChange(index, 'jmlNb', e.target.value)}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Editing {rows.length} therapy plans. Sistem akan membuat versi set baru.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 border border-transparent rounded-lg hover:from-amber-600 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-amber-500/30"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menyimpan...
                </>
              ) : (
                'Simpan Perubahan'
              )}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
