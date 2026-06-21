'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TherapyPlan, therapyPlanApi, BulkEditTherapyPlanSetInput } from '@/lib/therapyPlanApi';
import { showToast } from '../ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { THERAPY_PLAN_EDITORS, hasRole } from '@/types/auth';

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
  isLocked: boolean; // Plan sudah digunakan, tidak bisa diedit
}

export default function EditTherapyPlanSetModal({
  isOpen,
  onClose,
  memberId,
  therapyPlans,
  onSuccess,
}: EditTherapyPlanSetModalProps) {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [initialRows, setInitialRows] = useState<EditableRow[]>([]);
  const [editableSetName, setEditableSetName] = useState<string>('');
  const [initialSetName, setInitialSetName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Check if user has permission to edit set name and add plans
  const canEditSetNameAndAddPlans = user ? hasRole(user.role, THERAPY_PLAN_EDITORS) : false;

  // Draft storage key - use therapyPlanSetId from first plan if available
  const draftKey = `therapy-plan-edit-draft-${therapyPlans[0]?.therapyPlanSetId || memberId}`;

  // Helper function to normalize values: treat 0 as null (no meaningful dose)
  const normalizeValue = (value: number | null): number | null => {
    if (value === 0 || value === null) return null;
    return value;
  };

  // Helper function to check if two values are meaningfully different
  const hasValueChanged = (oldValue: number | null, newValue: number | null): boolean => {
    return normalizeValue(oldValue) !== normalizeValue(newValue);
  };

  // Save draft to localStorage
  const saveDraft = (data: EditableRow[]) => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        rows: data,
        timestamp: new Date().toISOString(),
      }));
      setHasDraft(true);
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  // Load draft from localStorage
  const loadDraft = (): EditableRow[] | null => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const { rows, timestamp } = JSON.parse(stored);
        // Check if draft is less than 7 days old
        const draftAge = Date.now() - new Date(timestamp).getTime();
        if (draftAge < 7 * 24 * 60 * 60 * 1000) {
          setHasDraft(true);
          return rows;
        } else {
          // Clear old draft
          localStorage.removeItem(draftKey);
        }
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
    return null;
  };

  // Clear draft from localStorage
  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
      setHasDraft(false);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  };

  // Discard draft and reset to initial
  const discardDraft = () => {
    clearDraft();
    setRows(initialRows.map(row => ({ ...row })));
    showToast.success('Draft berhasil dihapus');
  };

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-save draft when rows change (with debounce)
  useEffect(() => {
    if (!isOpen || rows.length === 0 || !initialRows.length) return;

    const timeoutId = setTimeout(() => {
      // Only save if there are changes
      if (hasChanges()) {
        saveDraft(rows);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [rows, isOpen]);

  // Load draft on mount
  useEffect(() => {
    if (isOpen && initialRows.length > 0 && !rows.length) {
      const draft = loadDraft();
      if (draft && draft.length === initialRows.length) {
        // Verify draft matches initial structure (same plan numbers)
        const draftValid = draft.every((draftRow, index) => 
          draftRow.planNumber === initialRows[index].planNumber
        );
        if (draftValid) {
          setRows(draft);
          showToast.info('Draft ditemukan dan dipulihkan');
        }
      }
    }
  }, [isOpen, initialRows]);

  // Initialize rows and set name from therapy plans
  useEffect(() => {
    if (isOpen && therapyPlans.length > 0) {
      const initialRowsData: EditableRow[] = therapyPlans
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
          isLocked: plan.isUsed, // Lock if already used in session
        }));
      setRows(initialRowsData);
      // Create a deep copy for initialRows to avoid reference issues
      setInitialRows(initialRowsData.map(row => ({ ...row })));
      
      // Initialize set name
      const currentSetName = therapyPlans[0]?.setName || '';
      setEditableSetName(currentSetName);
      setInitialSetName(currentSetName);
    }
  }, [isOpen, therapyPlans]);

  // Check if there are any meaningful changes (treating 0 as null)
  const hasChanges = () => {
    // Check if set name changed (only if user has permission)
    if (canEditSetNameAndAddPlans && editableSetName.trim() !== initialSetName.trim()) {
      return true;
    }
    
    if (rows.length !== initialRows.length) return true;
    
    return rows.some((row, index) => {
      const initialRow = initialRows[index];
      return (
        row.keterangan !== initialRow.keterangan ||
        hasValueChanged(initialRow.ifa250, row.ifa250) ||
        hasValueChanged(initialRow.ifa500, row.ifa500) ||
        hasValueChanged(initialRow.hho, row.hho) ||
        hasValueChanged(initialRow.h2, row.h2) ||
        hasValueChanged(initialRow.no, row.no) ||
        hasValueChanged(initialRow.gaso, row.gaso) ||
        hasValueChanged(initialRow.o2, row.o2) ||
        hasValueChanged(initialRow.o3, row.o3) ||
        hasValueChanged(initialRow.edta, row.edta) ||
        hasValueChanged(initialRow.mb, row.mb) ||
        hasValueChanged(initialRow.h2s, row.h2s) ||
        hasValueChanged(initialRow.kcl, row.kcl) ||
        hasValueChanged(initialRow.jmlNb, row.jmlNb)
      );
    });
  };

  // Add new empty therapy plan row
  const addNewRow = () => {
    if (!canEditSetNameAndAddPlans) {
      showToast.error('Anda tidak memiliki izin untuk menambah terapi baru');
      return;
    }
    
    // Find the highest plan number
    const maxPlanNumber = Math.max(...rows.map(r => r.planNumber), 0);
    const newPlanNumber = maxPlanNumber + 1;
    
    const newRow: EditableRow = {
      planNumber: newPlanNumber,
      keterangan: '',
      ifa250: null,
      ifa500: null,
      hho: null,
      h2: null,
      no: null,
      gaso: null,
      o2: null,
      o3: null,
      edta: null,
      mb: null,
      h2s: null,
      kcl: null,
      jmlNb: null,
      isLocked: false,
    };
    
    setRows([...rows, newRow]);
    showToast.success(`Terapi #${newPlanNumber} ditambahkan`);
  };

  const changesDetected = hasChanges();

  if (!isOpen || !mounted) return null;

  const setCode = therapyPlans[0]?.setCode || '';
  const setName = therapyPlans[0]?.setName || '';
  const setId = therapyPlans[0]?.therapyPlanSetId || '';

  const handleInputChange = (index: number, field: keyof EditableRow, value: string) => {
    const newRows = [...rows];
    if (field === 'keterangan') {
      newRows[index][field] = value;
    } else if (field !== 'planNumber' && field !== 'isLocked') {
      const numValue = value === '' ? null : parseFloat(value);
      // Prevent negative numbers
      if (numValue !== null && numValue < 0) {
        showToast.error('Tidak boleh mengisi angka negatif');
        return;
      }
      newRows[index][field] = isNaN(numValue as number) ? null : numValue;
    }
    setRows(newRows);
  };

  const validateRow = (row: EditableRow): string | null => {
    // Check if at least one dose field is > 0 (not just filled with 0)
    const hasMeaningfulDose = !!(
      (row.ifa250 && row.ifa250 > 0) ||
      (row.ifa500 && row.ifa500 > 0) ||
      (row.hho && row.hho > 0) ||
      (row.h2 && row.h2 > 0) ||
      (row.no && row.no > 0) ||
      (row.gaso && row.gaso > 0) ||
      (row.o2 && row.o2 > 0) ||
      (row.o3 && row.o3 > 0) ||
      (row.edta && row.edta > 0) ||
      (row.mb && row.mb > 0) ||
      (row.h2s && row.h2s > 0) ||
      (row.kcl && row.kcl > 0) ||
      (row.jmlNb && row.jmlNb > 0)
    );

    if (!hasMeaningfulDose) {
      return `Row ${row.planNumber}: Minimal satu field dosis harus diisi dengan nilai lebih dari 0`;
    }

    // Check IFA mutual exclusivity
    if (row.ifa250 && row.ifa250 > 0 && row.ifa500 && row.ifa500 > 0) {
      return `Row ${row.planNumber}: IFA 250ml dan IFA 500ml tidak boleh diisi bersamaan`;
    }

    // Check for negative values
    const hasNegative = [
      row.ifa250, row.ifa500, row.hho, row.h2, row.no,
      row.gaso, row.o2, row.o3, row.edta, row.mb,
      row.h2s, row.kcl, row.jmlNb
    ].some(val => val !== null && val < 0);

    if (hasNegative) {
      return `Row ${row.planNumber}: Tidak boleh ada nilai negatif`;
    }

    return null;
  };

  const handleSubmit = async () => {
    // Check for changes first
    if (!changesDetected) {
      showToast.error('Tidak ada perubahan yang dibuat');
      return;
    }

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
      // Find the maximum initial plan number to detect newly added rows
      const maxInitialPlanNumber = initialRows.length > 0 
        ? Math.max(...initialRows.map(r => r.planNumber)) 
        : 0;

      // Collect edited and newly added plans (excluding locked plans)
      const editedUnlockedPlans = rows.filter((row, index) => {
        // Skip locked plans
        if (row.isLocked) {
          return false;
        }
        
        // New rows: planNumber > maxInitialPlanNumber (always include)
        if (row.planNumber > maxInitialPlanNumber) {
          return true;
        }
        
        // Existing rows: check if meaningfully edited
        const initialRow = initialRows[index];
        if (!initialRow) return false; // Safety check
        
        return (
          row.keterangan !== initialRow.keterangan ||
          hasValueChanged(initialRow.ifa250, row.ifa250) ||
          hasValueChanged(initialRow.ifa500, row.ifa500) ||
          hasValueChanged(initialRow.hho, row.hho) ||
          hasValueChanged(initialRow.h2, row.h2) ||
          hasValueChanged(initialRow.no, row.no) ||
          hasValueChanged(initialRow.gaso, row.gaso) ||
          hasValueChanged(initialRow.o2, row.o2) ||
          hasValueChanged(initialRow.o3, row.o3) ||
          hasValueChanged(initialRow.edta, row.edta) ||
          hasValueChanged(initialRow.mb, row.mb) ||
          hasValueChanged(initialRow.h2s, row.h2s) ||
          hasValueChanged(initialRow.kcl, row.kcl) ||
          hasValueChanged(initialRow.jmlNb, row.jmlNb)
        );
      });

      // Check if set name changed (only include if user has permission)
      const setNameChanged = canEditSetNameAndAddPlans && 
        editableSetName.trim() !== initialSetName.trim();

      if (editedUnlockedPlans.length === 0 && !setNameChanged) {
        showToast.error('Tidak ada perubahan pada plan yang tidak terkunci atau nama set');
        setIsSubmitting(false);
        return;
      }

      const payload: BulkEditTherapyPlanSetInput = {
        plans: editedUnlockedPlans.map(row => ({
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

      // Include newSetName if it changed and user has permission
      if (setNameChanged) {
        payload.newSetName = editableSetName.trim() || undefined;
      }

      const response = await therapyPlanApi.bulkEditTherapyPlanSet(memberId, setId, payload);
      
      // Clear draft after successful submission
      clearDraft();
      
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

        {/* Draft Indicator Banner */}
        {hasDraft && changesDetected && (
          <div className="mx-6 mt-4 mb-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Draft tersimpan otomatis
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Perubahan Anda disimpan secara otomatis setiap 2 detik
                </p>
              </div>
            </div>
            <button
              onClick={discardDraft}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Hapus draft dan kembalikan ke data awal"
            >
              Buang Draft
            </button>
          </div>
        )}

        {/* Set Name and Add Row Controls - Only for authorized roles */}
        {canEditSetNameAndAddPlans && (
          <div className="mx-6 mt-4 mb-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Fitur Khusus (Dokter / Admin)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-amber-900 dark:text-amber-100 mb-1">
                  Nama Set Therapy Plan
                </label>
                <input
                  type="text"
                  value={editableSetName}
                  onChange={(e) => setEditableSetName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-sm border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  placeholder="Masukkan nama set (opsional)"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addNewRow}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 border border-transparent rounded-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-md"
                  title="Tambah terapi baru ke set ini"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Tambah Terapi
                </button>
              </div>
            </div>
          </div>
        )}

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
                  <tr key={row.planNumber} className={`${row.isLocked ? 'bg-neutral-100 dark:bg-neutral-800/30 opacity-60' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'}`}>
                    <td className="px-3 py-2 text-sm text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-700 font-medium">
                      <div className="flex items-center gap-1">
                        {row.isLocked && (
                          <span title="Terkunci - sudah digunakan dalam sesi">
                            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                        {row.planNumber}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="text"
                        value={row.keterangan}
                        onChange={(e) => handleInputChange(index, 'keterangan', e.target.value)}
                        disabled={row.isLocked}
                        className="w-32 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Keterangan"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-700">
                      <input
                        type="number"
                        value={row.ifa250 ?? ''}
                        onChange={(e) => handleInputChange(index, 'ifa250', e.target.value)}
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={row.isLocked}
                        className="w-20 px-2 py-1 text-sm text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            <p>Editing {rows.length} therapy plans. Sistem akan membuat versi set baru.</p>
            {rows.some(r => r.isLocked) && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                {rows.filter(r => r.isLocked).length} plan terkunci (sudah digunakan) dan tidak dapat diedit
              </p>
            )}
          </div>
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
              disabled={isSubmitting || !changesDetected}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 border border-transparent rounded-lg hover:from-amber-600 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-amber-500/30"
              title={!changesDetected ? 'Tidak ada perubahan yang dibuat' : ''}
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
