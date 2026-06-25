'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, CopyPlus, Plus, Package, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  therapyPlanApi,
  CreateTherapyPlanInput,
  PackageSummary,
} from '@/lib/therapyPlanApi';
import { showToast } from '@/lib/toast';
import {
  createDefaultIfaSubstances,
  prepareIfaSubstancePayload,
} from '@/lib/therapyPlanSubstances';

interface BulkTherapyPlanModalProps {
  memberId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface TherapyPlanRow extends CreateTherapyPlanInput {
  rowId: string;
  therapyNumber: number;
  ifaType: 'ifa250' | 'ifa500';
  groupId: string; // ID of the group this plan belongs to
}

interface TherapyGroup {
  id: string;
  name: string;
  setNumber: number;
  collapsed: boolean;
}

interface ValidationError {
  rowId: string;
  field: string;
  message: string;
}

export default function BulkTherapyPlanModal({
  memberId,
  onClose,
  onSuccess,
}: BulkTherapyPlanModalProps) {
  const [mounted, setMounted] = useState(false);
  const [packageSummary, setPackageSummary] = useState<PackageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [therapyPlans, setTherapyPlans] = useState<TherapyPlanRow[]>([]);
  const [therapyGroups, setTherapyGroups] = useState<TherapyGroup[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [numGroupsInput, setNumGroupsInput] = useState<string>('1');
  const [rowsPerGroupInput, setRowsPerGroupInput] = useState<string>('3');

  const generatedKeteranganPattern = /^Terapi ke-\d+\s*-\s*Set \d+$/i;

  const getStartTherapyNumber = () => {
    if (!packageSummary) return 1;

    const sessionsCompleted = packageSummary.package?.vouchersUsed || 0;
    const unusedPlans = packageSummary.therapyPlans.existing;
    return sessionsCompleted + unusedPlans + 1;
  };

  const buildKeterangan = (therapyNumber: number, setNumber: number) =>
    `Terapi ke-${therapyNumber} - Set ${setNumber}`;

  const createDefaultPlanRow = (
    rowId: string,
    groupId: string,
    therapyNumber: number,
    setNumber: number
  ): TherapyPlanRow => ({
    rowId,
    groupId,
    therapyNumber,
    keterangan: buildKeterangan(therapyNumber, setNumber),
    ifaType: 'ifa250',
    ifa250: 1,
    ifa500: undefined,
    hho: undefined,
    h2: undefined,
    no: undefined,
    gaso: undefined,
    o2: undefined,
    o3: undefined,
    edta: undefined,
    mb: undefined,
    h2s: undefined,
    kcl: undefined,
    jmlNb: undefined,
    ifaSubstances: createDefaultIfaSubstances(),
    ifaSubstanceTotalMl: 2.5,
  });

  const renumberPlanRows = (plans: TherapyPlanRow[], groups: TherapyGroup[]) => {
    let globalIndex = 0;
    const nextPlans: TherapyPlanRow[] = [];

    groups.forEach((group) => {
      plans
        .filter((plan) => plan.groupId === group.id)
        .forEach((plan) => {
          const therapyNumber = getStartTherapyNumber() + globalIndex;
          const isGeneratedKeterangan =
            !plan.keterangan || generatedKeteranganPattern.test(plan.keterangan.trim());

          nextPlans.push({
            ...plan,
            therapyNumber,
            keterangan: isGeneratedKeterangan
              ? buildKeterangan(therapyNumber, group.setNumber)
              : plan.keterangan,
          });
          globalIndex += 1;
        });
    });

    return nextPlans;
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mounted]);

  useEffect(() => {
    if (mounted) {
      loadPackageSummary();
    }
  }, [memberId, mounted]);

  useEffect(() => {
    if (packageSummary) {
      initializeTherapyPlans();
      setNumGroupsInput('1');
      setRowsPerGroupInput('3');
    }
  }, [packageSummary]);

  const loadPackageSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await therapyPlanApi.getMemberPackageSummary(memberId);
      console.log('📦 Package Summary Response:', summary);
      console.log('📊 Can Create:', summary.therapyPlans.canCreate);
      console.log('📈 Existing:', summary.therapyPlans.existing);
      console.log('🎫 Vouchers Total:', summary.package?.vouchersTotal);
      console.log('✅ Vouchers Used:', summary.package?.vouchersUsed);
      console.log('🔥 Vouchers Remaining:', summary.package?.vouchersRemaining);
      setPackageSummary(summary);
    } catch (err: any) {
      console.error('❌ Error loading package summary:', err);
      setError(err.response?.data?.error?.message || 'Gagal memuat informasi paket');
    } finally {
      setLoading(false);
    }
  };

  const initializeTherapyPlans = () => {
    if (!packageSummary) return;

    // Start with 1 group of 3 rows by default
    const numGroups = 1;
    const rowsPerGroup = 3;
    
    // Calculate the starting therapy number
    const sessionsCompleted = packageSummary.package?.vouchersUsed || 0;
    const unusedPlans = packageSummary.therapyPlans.existing;
    const startNumber = sessionsCompleted + unusedPlans + 1;
    
    const groups: TherapyGroup[] = [];
    const plans: TherapyPlanRow[] = [];

    console.log('🎯 Initializing therapy plans:');
    console.log('  Sessions completed:', sessionsCompleted);
    console.log('  Unused plans:', unusedPlans);
    console.log('  Start number:', startNumber);
    console.log('  Creating:', numGroups, 'group(s) with', rowsPerGroup, 'row(s) each');

    for (let g = 0; g < numGroups; g++) {
      const groupId = `group-${Date.now()}-${g}`;
      const setNumber = g + 1;
      
      groups.push({
        id: groupId,
        name: `Set #${setNumber}`,
        setNumber,
        collapsed: false,
      });

      for (let i = 0; i < rowsPerGroup; i++) {
        const therapyNum = startNumber + g * rowsPerGroup + i;

        plans.push({
          rowId: `row-${Date.now()}-${g}-${i}`,
          groupId: groupId,
          therapyNumber: therapyNum,
          keterangan: `Terapi ke-${therapyNum} - Set ${setNumber}`,
          ifaType: 'ifa250',
          ifa250: 1,
          ifa500: undefined,
          hho: undefined,
          h2: undefined,
          no: undefined,
          gaso: undefined,
          o2: undefined,
          o3: undefined,
          edta: undefined,
          mb: undefined,
          h2s: undefined,
          kcl: undefined,
          jmlNb: undefined,
          ifaSubstances: createDefaultIfaSubstances(),
          ifaSubstanceTotalMl: 2.5,
        });
      }
    }

    setTherapyGroups(groups);
    setTherapyPlans(plans);
    setValidationErrors([]);
  };

  const handleNumGroupsChange = (value: string) => {
    setNumGroupsInput(value);
    const numGroups = parseInt(value);
    const rowsPerGroup = parseInt(rowsPerGroupInput);
    
    if (!isNaN(numGroups) && numGroups >= 1 && numGroups <= 20 && !isNaN(rowsPerGroup) && rowsPerGroup >= 1) {
      regenerateTherapyPlans(numGroups, rowsPerGroup);
    }
  };

  const handleRowsPerGroupChange = (value: string) => {
    setRowsPerGroupInput(value);
    const numGroups = parseInt(numGroupsInput);
    const rowsPerGroup = parseInt(value);
    
    if (!isNaN(numGroups) && numGroups >= 1 && !isNaN(rowsPerGroup) && rowsPerGroup >= 1 && rowsPerGroup <= 30) {
      regenerateTherapyPlans(numGroups, rowsPerGroup);
    }
  };

  const regenerateTherapyPlans = (numGroups: number, rowsPerGroup: number) => {
    if (!packageSummary) return;

    const sessionsCompleted = packageSummary.package?.vouchersUsed || 0;
    const unusedPlans = packageSummary.therapyPlans.existing;
    const startNumber = sessionsCompleted + unusedPlans + 1;
    
    const groups: TherapyGroup[] = [];
    const plans: TherapyPlanRow[] = [];

    for (let g = 0; g < numGroups; g++) {
      const groupId = `group-${Date.now()}-${g}`;
      const setNumber = g + 1;
      
      groups.push({
        id: groupId,
        name: `Set #${setNumber}`,
        setNumber,
        collapsed: false,
      });

      for (let i = 0; i < rowsPerGroup; i++) {
        const therapyNum = startNumber + g * rowsPerGroup + i;

        plans.push({
          rowId: `row-${Date.now()}-${g}-${i}`,
          groupId: groupId,
          therapyNumber: therapyNum,
          keterangan: `Terapi ke-${therapyNum} - Set ${setNumber}`,
          ifaType: 'ifa250',
          ifa250: 1,
          ifa500: undefined,
          hho: undefined,
          h2: undefined,
          no: undefined,
          gaso: undefined,
          o2: undefined,
          o3: undefined,
          edta: undefined,
          mb: undefined,
          h2s: undefined,
          kcl: undefined,
          jmlNb: undefined,
          ifaSubstances: createDefaultIfaSubstances(),
          ifaSubstanceTotalMl: 2.5,
        });
      }
    }

    setTherapyGroups(groups);
    setTherapyPlans(plans);
  };

  const toggleGroupCollapse = (groupId: string) => {
    setTherapyGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
      )
    );
  };

  const addRowToGroup = (groupId: string) => {
    const group = therapyGroups.find((g) => g.id === groupId);
    if (!group) return;

    const newRow: TherapyPlanRow = {
      ...createDefaultPlanRow(`row-${Date.now()}`, groupId, 0, group.setNumber),
    };

    setTherapyPlans((prev) => {
      const nextPlans = [...prev];
      const lastGroupRowIndex = nextPlans.map((plan) => plan.groupId).lastIndexOf(groupId);
      nextPlans.splice(lastGroupRowIndex + 1, 0, newRow);
      return renumberPlanRows(nextPlans, therapyGroups);
    });
    showToast.success('Terapi baru ditambahkan ke set');
  };

  const removeRow = (rowId: string, groupId: string) => {
    const groupPlans = therapyPlans.filter((p) => p.groupId === groupId);
    
    if (groupPlans.length === 1) {
      showToast.error('Minimal harus ada 1 terapi per set');
      return;
    }

    setTherapyPlans((prev) =>
      renumberPlanRows(
        prev.filter((p) => p.rowId !== rowId),
        therapyGroups
      )
    );
    showToast.success('Terapi dihapus');
  };

  const updateTherapyPlan = (
    rowId: string,
    field: keyof CreateTherapyPlanInput | 'ifaType',
    value: string | number | undefined
  ) => {
    setTherapyPlans((prev) =>
      prev.map((plan) => {
        if (plan.rowId !== rowId) return plan;

        if (field === 'ifaType') {
          // Update IFA type selection
          const ifaType = value as 'ifa250' | 'ifa500';
          return {
            ...plan,
            ifaType,
            ifa250: ifaType === 'ifa250' ? 1 : undefined,
            ifa500: ifaType === 'ifa500' ? 1 : undefined,
            ifaSubstances: ifaType === 'ifa250' ? createDefaultIfaSubstances() : [],
            ifaSubstanceTotalMl: ifaType === 'ifa250' ? 2.5 : 0,
          };
        }

        return { ...plan, [field]: value };
      })
    );
  };

  const copyToNextRow = (rowId: string) => {
    const currentIndex = therapyPlans.findIndex((p) => p.rowId === rowId);
    if (currentIndex === -1 || currentIndex === therapyPlans.length - 1) return;

    const currentPlan = therapyPlans[currentIndex];
    const nextPlan = therapyPlans[currentIndex + 1];

    setTherapyPlans((prev) =>
      prev.map((plan) =>
        plan.rowId === nextPlan.rowId
          ? {
              ...plan,
              ifaType: currentPlan.ifaType,
              ifa250: currentPlan.ifa250,
              ifa500: currentPlan.ifa500,
              hho: currentPlan.hho,
              h2: currentPlan.h2,
              no: currentPlan.no,
              gaso: currentPlan.gaso,
              o2: currentPlan.o2,
              o3: currentPlan.o3,
              edta: currentPlan.edta,
              mb: currentPlan.mb,
              h2s: currentPlan.h2s,
              kcl: currentPlan.kcl,
              jmlNb: currentPlan.jmlNb,
              ifaSubstances: currentPlan.ifaSubstances,
              ifaSubstanceTotalMl: currentPlan.ifaSubstanceTotalMl,
            }
          : plan
      )
    );

    showToast.success('Data berhasil disalin ke terapi berikutnya');
  };

  const copyToAllBelow = (rowId: string) => {
    const currentIndex = therapyPlans.findIndex((p) => p.rowId === rowId);
    if (currentIndex === -1 || currentIndex === therapyPlans.length - 1) return;

    const currentPlan = therapyPlans[currentIndex];

    setTherapyPlans((prev) =>
      prev.map((plan, idx) => {
        if (idx <= currentIndex) return plan;

        return {
          ...plan,
          ifaType: currentPlan.ifaType,
          ifa250: currentPlan.ifa250,
          ifa500: currentPlan.ifa500,
          hho: currentPlan.hho,
          h2: currentPlan.h2,
          no: currentPlan.no,
          gaso: currentPlan.gaso,
          o2: currentPlan.o2,
          o3: currentPlan.o3,
          edta: currentPlan.edta,
          mb: currentPlan.mb,
          h2s: currentPlan.h2s,
          kcl: currentPlan.kcl,
          jmlNb: currentPlan.jmlNb,
          ifaSubstances: currentPlan.ifaSubstances,
          ifaSubstanceTotalMl: currentPlan.ifaSubstanceTotalMl,
        };
      })
    );

    showToast.success('Data berhasil disalin ke semua terapi di bawah');
  };

  const validateTherapyPlans = (): boolean => {
    const errors: ValidationError[] = [];

    therapyPlans.forEach((plan) => {
      // Check that at least one dose field is filled
      const hasDoseData =
        plan.ifa250 ||
        plan.ifa500 ||
        plan.hho ||
        plan.h2 ||
        plan.no ||
        plan.gaso ||
        plan.o2 ||
        plan.o3 ||
        plan.edta ||
        plan.mb ||
        plan.h2s ||
        plan.kcl ||
        plan.jmlNb;

      if (!hasDoseData) {
        errors.push({
          rowId: plan.rowId,
          field: 'all',
          message: 'Minimal 1 dosis harus diisi',
        });
      }

      // Validate IFA mutual exclusivity
      if (plan.ifa250 && plan.ifa500) {
        errors.push({
          rowId: plan.rowId,
          field: 'ifa',
          message: 'Tidak boleh mengisi IFA250 dan IFA500 bersamaan',
        });
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateTherapyPlans()) {
      showToast.error('Mohon perbaiki error validasi');
      return;
    }

    try {
      setSubmitting(true);

      const plansToSubmit: CreateTherapyPlanInput[] = therapyPlans.map((plan) => ({
        keterangan: plan.keterangan,
        ifa250: plan.ifa250,
        ifa500: plan.ifa500,
        hho: plan.hho,
        h2: plan.h2,
        no: plan.no,
        gaso: plan.gaso,
        o2: plan.o2,
        o3: plan.o3,
        edta: plan.edta,
        mb: plan.mb,
        h2s: plan.h2s,
        kcl: plan.kcl,
        jmlNb: plan.jmlNb,
        ...prepareIfaSubstancePayload(plan.ifaSubstances),
      }));

      const response = await therapyPlanApi.bulkCreateTherapyPlans(memberId, {
        therapyPlans: plansToSubmit,
      });

      showToast.success(response.message || 'Rencana terapi berhasil dibuat');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast.error(
        err.response?.data?.error?.message || 'Gagal membuat rencana terapi'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getRowError = (rowId: string): string | null => {
    const error = validationErrors.find((e) => e.rowId === rowId);
    return error ? error.message : null;
  };

  const doseFields = [
    { key: 'hho', label: 'HHO' },
    { key: 'h2', label: 'H2' },
    { key: 'no', label: 'NO' },
    { key: 'gaso', label: 'GASO' },
    { key: 'o2', label: 'O2' },
    { key: 'o3', label: 'O3' },
    { key: 'edta', label: 'EDTA' },
    { key: 'mb', label: 'MB' },
    { key: 'h2s', label: 'H2S' },
    { key: 'kcl', label: 'KCL' },
    { key: 'jmlNb', label: 'JML NB' },
  ] as const;

  if (!mounted) return null;

  // Loading state
  if (loading) {
    const loadingContent = (
      <div className="fixed inset-0 z-[9999] overflow-hidden">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-8 shadow-2xl">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mb-4"></div>
              <p className="text-neutral-700 dark:text-neutral-300">Memuat data...</p>
            </div>
          </div>
        </div>
      </div>
    );
    return createPortal(loadingContent, document.body);
  }

  // Error state
  if (error) {
    const errorContent = (
      <div className="fixed inset-0 z-[9999] overflow-hidden">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400">Error</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
    return createPortal(errorContent, document.body);
  }

  if (!packageSummary) return null;

  // Main modal content
  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container - Wider and responsive */}
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
        <div
          className="relative w-full max-w-[95vw] lg:max-w-5xl flex flex-col bg-white dark:bg-neutral-900 shadow-2xl transform transition-all rounded-2xl max-h-[92vh]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0 sticky top-0 bg-white dark:bg-neutral-900 z-30">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  Buat Set Therapy Plan
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-500 text-white">
                    {therapyPlans.length} Terapi
                  </span>
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {packageSummary.member.fullName} <span className="text-neutral-400 dark:text-neutral-500">({packageSummary.member.memberNo})</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body - Table Container */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {/* Control Section */}
            <div className="mb-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Jumlah Set:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={numGroupsInput}
                    onChange={(e) => handleNumGroupsChange(e.target.value)}
                    disabled={submitting}
                    className="w-20 px-3 py-2 text-center border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold disabled:opacity-50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Terapi per Set:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={rowsPerGroupInput}
                    onChange={(e) => handleRowsPerGroupChange(e.target.value)}
                    disabled={submitting}
                    className="w-20 px-3 py-2 text-center border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold disabled:opacity-50"
                  />
                </div>
                <div className="flex-1" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Total: <span className="font-bold text-lg text-green-600 dark:text-green-400">{therapyGroups.length}</span> set, <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{therapyPlans.length}</span> terapi
                </p>
              </div>
            </div>

            {/* Accordion Groups */}
            <div className="space-y-3">
              {therapyGroups.map((group) => {
                const groupPlans = therapyPlans.filter((p) => p.groupId === group.id);
                const groupErrors = groupPlans.filter((p) => getRowError(p.rowId)).length;
                
                return (
                  <div
                    key={group.id}
                    className="border border-neutral-300 dark:border-neutral-600 rounded-lg overflow-hidden bg-white dark:bg-neutral-900"
                  >
                    {/* Group Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-neutral-300 dark:border-neutral-600">
                      <button
                        onClick={() => toggleGroupCollapse(group.id)}
                        className="flex items-center gap-2 flex-1 text-left group"
                        disabled={submitting}
                      >
                        {group.collapsed ? (
                          <ChevronRight className="h-5 w-5 text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors" />
                        )}
                        <span className="font-bold text-lg text-amber-700 dark:text-amber-400">
                          {group.name}
                        </span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          ({groupPlans.length} terapi)
                        </span>
                        {groupErrors > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold">
                            {groupErrors} error
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => addRowToGroup(group.id)}
                        disabled={submitting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30 transition-colors text-xs font-semibold disabled:opacity-50"
                        title="Tambah terapi ke set ini"
                      >
                        <Plus size={14} />
                        Tambah Terapi
                      </button>
                    </div>

                    {/* Group Content */}
                    {!group.collapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                              <th className="px-2 py-2 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-700 w-12">
                                #
                              </th>
                              <th className="px-2 py-2 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-700 min-w-[140px]">
                                Keterangan
                              </th>
                              <th className="px-2 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-700 min-w-[120px]">
                                IFA
                              </th>
                              {doseFields.map((field) => (
                                <th
                                  key={field.key}
                                  className="px-2 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-700 w-16"
                                >
                                  {field.label}
                                </th>
                              ))}
                              <th className="px-2 py-2 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 w-24">
                                Aksi
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupPlans.map((plan, idx) => {
                              const rowError = getRowError(plan.rowId);
                              return (
                                <tr
                                  key={plan.rowId}
                                  className={`border-b border-neutral-200 dark:border-neutral-700 ${
                                    rowError ? 'bg-red-50 dark:bg-red-500/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                                  }`}
                                >
                                  <td className="px-2 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 border-r border-neutral-200 dark:border-neutral-700">
                                    {idx + 1}
                                  </td>
                                  <td className="px-2 py-2 border-r border-neutral-200 dark:border-neutral-700">
                                    <input
                                      type="text"
                                      value={plan.keterangan || ''}
                                      onChange={(e) =>
                                        updateTherapyPlan(plan.rowId, 'keterangan', e.target.value)
                                      }
                                      disabled={submitting}
                                      className="w-full px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                  </td>
                                  <td className="px-2 py-2 border-r border-neutral-200 dark:border-neutral-700">
                                    <div className="flex flex-col gap-1">
                                      <label className="flex items-center gap-1 p-1.5 rounded border cursor-pointer text-xs"
                                        style={{
                                          background: plan.ifaType === 'ifa250' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.02)',
                                          borderColor: plan.ifaType === 'ifa250' ? '#4ade80' : 'rgba(148,163,184,0.3)',
                                        }}>
                                        <input
                                          type="radio"
                                          name={`ifa-${plan.rowId}`}
                                          checked={plan.ifaType === 'ifa250'}
                                          onChange={() => updateTherapyPlan(plan.rowId, 'ifaType', 'ifa250')}
                                          disabled={submitting}
                                          className="w-3 h-3"
                                          style={{ accentColor: '#4ade80' }}
                                        />
                                        <span className="font-semibold" style={{ color: plan.ifaType === 'ifa250' ? '#4ade80' : '#94a3b8' }}>
                                          250ml
                                        </span>
                                      </label>
                                      <label className="flex items-center gap-1 p-1.5 rounded border cursor-pointer text-xs"
                                        style={{
                                          background: plan.ifaType === 'ifa500' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.02)',
                                          borderColor: plan.ifaType === 'ifa500' ? '#fbbf24' : 'rgba(148,163,184,0.3)',
                                        }}>
                                        <input
                                          type="radio"
                                          name={`ifa-${plan.rowId}`}
                                          checked={plan.ifaType === 'ifa500'}
                                          onChange={() => updateTherapyPlan(plan.rowId, 'ifaType', 'ifa500')}
                                          disabled={submitting}
                                          className="w-3 h-3"
                                          style={{ accentColor: '#fbbf24' }}
                                        />
                                        <span className="font-semibold" style={{ color: plan.ifaType === 'ifa500' ? '#fbbf24' : '#94a3b8' }}>
                                          500ml
                                        </span>
                                      </label>
                                    </div>
                                  </td>
                                  {doseFields.map((field) => (
                                    <td
                                      key={field.key}
                                      className="px-2 py-2 border-r border-neutral-200 dark:border-neutral-700"
                                    >
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        value={plan[field.key] || ''}
                                        onChange={(e) =>
                                          updateTherapyPlan(
                                            plan.rowId,
                                            field.key,
                                            e.target.value ? parseFloat(e.target.value) : undefined
                                          )
                                        }
                                        disabled={submitting}
                                        className="w-full px-1 py-1 text-xs text-center border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-2 py-2">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <button
                                        onClick={() => copyToNextRow(plan.rowId)}
                                        disabled={submitting || idx === groupPlans.length - 1}
                                        title="Copy to next"
                                        className="p-1 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors"
                                      >
                                        <Copy size={12} />
                                      </button>
                                      <button
                                        onClick={() => copyToAllBelow(plan.rowId)}
                                        disabled={submitting || idx === groupPlans.length - 1}
                                        title="Copy all below"
                                        className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20 transition-colors"
                                      >
                                        <CopyPlus size={12} />
                                      </button>
                                      <button
                                        onClick={() => removeRow(plan.rowId, group.id)}
                                        disabled={submitting || groupPlans.length === 1}
                                        title="Delete"
                                        className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Validation Errors - Compact */}
            {validationErrors.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                  ⚠️ Error Validasi:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {validationErrors.map((error, idx) => (
                    <li key={idx} className="text-xs text-red-600 dark:text-red-400">
                      Terapi ke-{therapyPlans.find((p) => p.rowId === error.rowId)?.therapyNumber}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info Section - Compact */}
            <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Tips:</strong> Masukkan jumlah terapi per set, pilih IFA, lalu gunakan tombol copy untuk duplikasi dosis.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/50 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex-1"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || therapyPlans.length === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 flex items-center gap-2 flex-1 justify-center"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Simpan Set ({therapyPlans.length} Terapi)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
