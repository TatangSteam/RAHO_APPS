'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import { memberApi } from '@/lib/memberApi';
import { usersApi, type StaffMember } from '@/lib/usersApi';
import { therapyPlanApi, type TherapyPlan } from '@/lib/therapyPlanApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { useAuthStore } from '@/stores/authStore';
import type { SessionDetail } from '@/types/session';
import Step1Diagnosis from '@/components/sessions/Step1Diagnosis';
import Step2TherapyPlan from '@/components/sessions/Step2TherapyPlan';
import Step3VitalBefore from '@/components/sessions/Step3VitalBefore';
import Step5Infusion from '@/components/sessions/Step5Infusion';
import Step6Materials from '@/components/sessions/Step6Materials';
import Step7Photo from '@/components/sessions/Step7Photo';
import Step8VitalAfter from '@/components/sessions/Step8VitalAfter';
import Step8ComplaintsRecommendations from '@/components/sessions/Step8ComplaintsRecommendations';
import Step9Evaluation from '@/components/sessions/Step9Evaluation';
import EditTherapyPlanSetModal from '@/components/therapy-plan/EditTherapyPlanSetModal';
import { RotateCcw, X } from 'lucide-react';

type BoosterPackageOption = {
  packageId: string;
  packageCode: string;
  packageType: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  status: string;
  branchId?: string;
  branchName?: string;
  disabledReason?: string;
};

const getPackageId = (pkg: any) => pkg.packageId || pkg.id || '';

const flattenMemberPackages = (packages: any[]): BoosterPackageOption[] => {
  const flattened: BoosterPackageOption[] = [];

  packages.forEach((pkg) => {
    if (pkg?.isGroup) {
      [...(pkg.basics || []), ...(pkg.boosters || [])].forEach((groupedPackage) => {
        flattened.push({ ...groupedPackage, packageId: getPackageId(groupedPackage) });
      });
      return;
    }

    flattened.push({ ...pkg, packageId: getPackageId(pkg) });
  });

  return flattened.filter((pkg) => pkg.packageId);
};

const toDateTimeLocalValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const mergeStaffOptions = (options: StaffMember[], current?: { userId: string; fullName: string; staffCode?: string | null }) => {
  if (!current?.userId || options.some((option) => option.userId === current.userId)) {
    return options;
  }

  return [
    {
      userId: current.userId,
      fullName: current.fullName,
      staffCode: current.staffCode || '',
    },
    ...options,
  ];
};

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const sessionId = params.sessionId as string;
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : null;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [completing, setCompleting] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationKey, setCancellationKey] = useState('');
  const [cancellingCompletion, setCancellingCompletion] = useState(false);
  const [showStaffInfo, setShowStaffInfo] = useState(false);
  const [showTherapyPlanEditModal, setShowTherapyPlanEditModal] = useState(false);
  const [therapyPlanSetForEdit, setTherapyPlanSetForEdit] = useState<TherapyPlan[]>([]);
  const [loadingTherapyPlanEdit, setLoadingTherapyPlanEdit] = useState(false);
  const [showBoosterEditModal, setShowBoosterEditModal] = useState(false);
  const [loadingBoosterPackages, setLoadingBoosterPackages] = useState(false);
  const [savingBoosterPackage, setSavingBoosterPackage] = useState(false);
  const [boosterPackages, setBoosterPackages] = useState<BoosterPackageOption[]>([]);
  const [basicPackages, setBasicPackages] = useState<BoosterPackageOption[]>([]);
  const [adminLayananOptions, setAdminLayananOptions] = useState<StaffMember[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<StaffMember[]>([]);
  const [nurseOptions, setNurseOptions] = useState<StaffMember[]>([]);
  const [sessionEditMemberPackageId, setSessionEditMemberPackageId] = useState('');
  const [sessionEditTreatmentDate, setSessionEditTreatmentDate] = useState('');
  const [sessionEditPelaksanaan, setSessionEditPelaksanaan] = useState<'ON_SITE' | 'HOME_CARE'>('ON_SITE');
  const [sessionEditAdminLayananId, setSessionEditAdminLayananId] = useState('');
  const [sessionEditDoctorId, setSessionEditDoctorId] = useState('');
  const [sessionEditNurseId, setSessionEditNurseId] = useState('');
  const [sessionEditAdditionalDoctorIds, setSessionEditAdditionalDoctorIds] = useState<string[]>([]);
  const [sessionEditAdditionalNurseIds, setSessionEditAdditionalNurseIds] = useState<string[]>([]);
  const [sessionEditInfusKe, setSessionEditInfusKe] = useState<number | ''>('');
  const [sessionEditBranchInfusKe, setSessionEditBranchInfusKe] = useState<number | ''>('');
  const [sessionEditShiftFollowing, setSessionEditShiftFollowing] = useState(false);
  const [boosterEditUseBooster, setBoosterEditUseBooster] = useState(false);
  const [boosterEditPackageId, setBoosterEditPackageId] = useState('');
  const [boosterEditError, setBoosterEditError] = useState<string | null>(null);

  useEffect(() => {
    loadSessionDetail();
  }, [sessionId]);

  const loadSessionDetail = async () => {
    try {
      setLoading(true);
      const data = await sessionApi.getSessionById(sessionId);
      setSession(data);
      
      // Auto-select first incomplete step only on initial load (when activeStep is default)
      // Don't change activeStep if user is already working on a specific step
      if (data.steps && activeStep === 1 && data.steps.step1_diagnosis) {
        if (!data.steps.step1_diagnosis) setActiveStep(1);
        else if (!data.steps.step2_therapyPlan) setActiveStep(2);
        else if (!data.steps.step3_vitalBefore) setActiveStep(3);
        else if (!data.steps.step4_infusion) setActiveStep(4);
        else if (!data.steps.step5_materials) setActiveStep(5);
        else if (!data.steps.step6_photo) setActiveStep(6);
        else if (!data.steps.step7_vitalAfter) setActiveStep(7);
        else if (!data.steps.step8_evaluation) setActiveStep(9); // Step 8 is optional, Step 9 is required
      }
    } catch (error: any) {
      devError('Error loading session detail:', error);
      const errorMessage = error.response?.data?.error?.message || 'Gagal memuat detail sesi';
      showToast.error(errorMessage);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = async () => {
    await loadSessionDetail();
  };

  const openTherapyPlanEditModal = async () => {
    if (loadingTherapyPlanEdit) return;

    if (!session?.therapyPlan?.therapyPlanSetId) {
      showToast.error('Therapy plan sesi ini belum berada dalam set yang bisa diedit');
      return;
    }

    try {
      setLoadingTherapyPlanEdit(true);
      const therapyPlanSet = await therapyPlanApi.getSessionTherapyPlanSet(sessionId);
      if (therapyPlanSet.length === 0) {
        showToast.error('Set therapy plan sesi ini tidak ditemukan');
        return;
      }

      setTherapyPlanSetForEdit(therapyPlanSet);
      setShowTherapyPlanEditModal(true);
    } catch (error: any) {
      devError('Error loading therapy plan set for edit:', error);
      const errorMessage = error.response?.data?.error?.message || 'Gagal memuat set therapy plan';
      showToast.error(errorMessage);
    } finally {
      setLoadingTherapyPlanEdit(false);
    }
  };

  const handleTherapyPlanEditSuccess = async () => {
    setShowTherapyPlanEditModal(false);
    setTherapyPlanSetForEdit([]);
    await loadSessionDetail();
    setActiveStep(4);
  };

  const formatPackageLabel = (pkg: BoosterPackageOption) => {
    const branchLabel = pkg.branchName ? ` - ${pkg.branchName}` : '';
    return `${pkg.packageCode} (${pkg.remainingSessions}/${pkg.totalSessions} sisa)${branchLabel}`;
  };

  const toggleSelectedId = (selectedIds: string[], id: string) => {
    return selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];
  };

  const openBoosterEditModal = async () => {
    if (!session) return;

    setBoosterEditError(null);
    setSessionEditMemberPackageId(session.session.memberPackage?.packageId || '');
    setSessionEditTreatmentDate(toDateTimeLocalValue(session.session.treatmentDate));
    setSessionEditPelaksanaan(session.session.pelaksanaan);
    setSessionEditAdminLayananId(session.session.adminLayanan.userId);
    setSessionEditDoctorId(session.session.doctor.userId);
    setSessionEditNurseId(session.session.nurse.userId);
    setSessionEditInfusKe(session.session.infusKe || '');
    setSessionEditBranchInfusKe(session.session.branchInfusKe || session.session.infusKe || '');
    setSessionEditShiftFollowing(false);
    setSessionEditAdditionalDoctorIds(
      (session.session.sessionDoctors || [])
        .filter((assignment) => !assignment.isPrimary)
        .map((assignment) => assignment.doctor.userId)
    );
    setSessionEditAdditionalNurseIds(
      (session.session.sessionNurses || [])
        .filter((assignment) => !assignment.isPrimary)
        .map((assignment) => assignment.nurse.userId)
    );
    setBoosterEditUseBooster(!!session.session.boosterPackage);
    setBoosterEditPackageId(session.session.boosterPackage?.packageId || '');
    setShowBoosterEditModal(true);
    setLoadingBoosterPackages(true);

    try {
      const packageBranchId =
        user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER'
          ? 'all'
          : session.session.branchId;
      const [packages, admins, doctors, nurses] = await Promise.all([
        memberApi.getMemberPackages(session.memberId, packageBranchId),
        usersApi.getAdminLayanan(session.session.branchId),
        usersApi.getDoctors(session.session.branchId),
        usersApi.getNurses(session.session.branchId),
      ]);
      const flatPackages = flattenMemberPackages(packages);
      const currentBasicPackageId = session.session.memberPackage?.packageId;
      const currentPackageId = session.session.boosterPackage?.packageId;
      const sessionBranchId = session.session.branchId;
      const availableBasics = flatPackages.filter((pkg: any) => {
        const packageId = getPackageId(pkg);
        const isCurrentPackage = packageId === currentBasicPackageId;
        const isSameBranch = !pkg.branchId || !sessionBranchId || pkg.branchId === sessionBranchId;
        const hasRemainingSession = Number(pkg.remainingSessions || 0) > 0;

        return (
          pkg.packageType === 'BASIC' &&
          isSameBranch &&
          (isCurrentPackage || (pkg.status === 'ACTIVE' && hasRemainingSession))
        );
      });
      const boosterOptions = flatPackages
        .filter((pkg: any) => pkg.packageType === 'BOOSTER')
        .map((pkg: any) => {
        const packageId = getPackageId(pkg);
        const isCurrentPackage = packageId === currentPackageId;
        const isSameBranch = !pkg.branchId || !sessionBranchId || pkg.branchId === sessionBranchId;
        const hasRemainingSession = Number(pkg.remainingSessions || 0) > 0;
          const disabledReasons = [
            !isSameBranch
              ? `beda cabang${pkg.branchName ? ` (${pkg.branchName})` : ''}`
              : null,
            pkg.status !== 'ACTIVE' ? `status ${pkg.status}` : null,
            !hasRemainingSession ? 'sisa sesi 0' : null,
          ].filter(Boolean);

          return {
            ...pkg,
            packageId,
            disabledReason:
              isCurrentPackage || disabledReasons.length === 0
                ? undefined
                : disabledReasons.join(', '),
          };
        });

      setBasicPackages(availableBasics);
      setBoosterPackages(boosterOptions);
      setAdminLayananOptions(mergeStaffOptions(admins, session.session.adminLayanan));
      setDoctorOptions(mergeStaffOptions(doctors, session.session.doctor));
      setNurseOptions(mergeStaffOptions(nurses, session.session.nurse));
    } catch (error: any) {
      devError('Error loading session edit data:', error);
      setBoosterEditError(error.response?.data?.error?.message || 'Gagal memuat data edit sesi');
    } finally {
      setLoadingBoosterPackages(false);
    }
  };

  const handleSaveBoosterPackage = async () => {
    if (!session) return;

    if (!sessionEditMemberPackageId) {
      setBoosterEditError('Pilih paket dasar terlebih dahulu');
      return;
    }

    if (!sessionEditTreatmentDate) {
      setBoosterEditError('Tanggal terapi wajib diisi');
      return;
    }

    if (!sessionEditAdminLayananId || !sessionEditDoctorId || !sessionEditNurseId) {
      setBoosterEditError('Admin layanan, dokter, dan nakes wajib dipilih');
      return;
    }

    if (!sessionEditInfusKe || Number(sessionEditInfusKe) < 1) {
      setBoosterEditError('Nomor sesi global wajib diisi dan minimal 1');
      return;
    }

    if (!sessionEditBranchInfusKe || Number(sessionEditBranchInfusKe) < 1) {
      setBoosterEditError('Nomor sesi cabang wajib diisi dan minimal 1');
      return;
    }

    if (boosterEditUseBooster && !boosterEditPackageId) {
      setBoosterEditError('Pilih paket booster terlebih dahulu');
      return;
    }

    try {
      setSavingBoosterPackage(true);
      setBoosterEditError(null);
      await sessionApi.updateSessionDetails(sessionId, {
        memberPackageId: sessionEditMemberPackageId,
        treatmentDate: new Date(sessionEditTreatmentDate).toISOString(),
        pelaksanaan: sessionEditPelaksanaan,
        infusKe: Number(sessionEditInfusKe),
        branchInfusKe: Number(sessionEditBranchInfusKe),
        shiftFollowingSessions: sessionEditShiftFollowing,
        adminLayananId: sessionEditAdminLayananId,
        doctorId: sessionEditDoctorId,
        nurseId: sessionEditNurseId,
        additionalDoctorIds: sessionEditAdditionalDoctorIds.filter((doctorId) => doctorId !== sessionEditDoctorId),
        additionalNurseIds: sessionEditAdditionalNurseIds.filter((nurseId) => nurseId !== sessionEditNurseId),
        ...(session.session.boosterPackage?.boosterType
          ? {}
          : {
              useBooster: boosterEditUseBooster,
              boosterPackageId: boosterEditUseBooster ? boosterEditPackageId : null,
            }),
      });

      showToast.success('Data sesi berhasil diperbarui');
      setShowBoosterEditModal(false);
      await loadSessionDetail();
    } catch (error: any) {
      devError('Error updating session details:', error);
      setBoosterEditError(error.response?.data?.error?.message || 'Gagal memperbarui data sesi');
    } finally {
      setSavingBoosterPackage(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!session) return;

    const { steps } = session;
    
    // Validate required steps
    if (!steps.step1_diagnosis) {
      showToast.error('Diagnosis belum diisi');
      return;
    }
    if (!steps.step2_therapyPlan) {
      showToast.error('Therapy Plan belum diisi');
      return;
    }
    if (!steps.step3_vitalBefore) {
      showToast.error('Tanda vital SEBELUM belum diisi');
      return;
    }
    if (!steps.step4_infusion) {
      showToast.error('Infus aktual belum dibuat');
      return;
    }
    if (!steps.step5_materials) {
      showToast.error('Material usage belum dicatat');
      return;
    }
    if (!steps.step7_vitalAfter) {
      showToast.error('Tanda vital SESUDAH belum diisi');
      return;
    }
    if (!steps.step8_evaluation) {
      showToast.error('Evaluasi dokter belum diisi');
      return;
    }

    try {
      setCompleting(true);
      const result = await sessionApi.completeSession(sessionId);
      showToast.success(result.message);
      router.push(`/members/${session.session.member.memberId}`);
    } catch (error: any) {
      devError('Error completing session:', error);
      const errorMessage = error.response?.data?.error?.message || 'Gagal menyelesaikan sesi';
      showToast.error(errorMessage);
    } finally {
      setCompleting(false);
    }
  };

  const closeCancellationModal = () => {
    if (cancellingCompletion) return;
    setShowCancellationModal(false);
    setCancellationReason('');
    setCancellationKey('');
  };

  const handleCancelCompletion = async () => {
    const reason = cancellationReason.trim();
    if (reason.length < 5) {
      showToast.error('Alasan pembatalan minimal 5 karakter');
      return;
    }
    const idempotencyKey = cancellationKey || crypto.randomUUID();
    if (!cancellationKey) setCancellationKey(idempotencyKey);
    try {
      setCancellingCompletion(true);
      const result = await sessionApi.cancelCompletion(sessionId, { idempotencyKey, reason });
      showToast.success(result.message);
      setShowCancellationModal(false);
      setCancellationReason('');
      setCancellationKey('');
      await loadSessionDetail();
    } catch (error: any) {
      devError('Error cancelling treatment completion:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal membatalkan completion sesi');
    } finally {
      setCancellingCompletion(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="spinner" style={{ width: '48px', height: '48px', margin: '0 auto 16px' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Memuat detail sesi...</p>
      </div>
    );
  }

  if (!session) return null;

  const { session: sessionInfo, steps } = session;
  const canEditSessionBoosterPackage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';
  const canCancelCompletion = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(user?.role || '');
  const isCompletionCancelled = sessionInfo.completionStatus === 'CANCELLED';
  const boosterPackageChangeLocked = !!sessionInfo.boosterPackage?.boosterType;
  
  // Check if step can be accessed
  const canAccessStep = (step: number): boolean => {
    if (step === 1) return true; // Diagnosis always accessible
    if (step === 2) return steps.step1_diagnosis; // Therapy Plan needs diagnosis
    if (step === 3) return steps.step2_therapyPlan; // Vital Before needs therapy plan
    if (step === 4) return steps.step2_therapyPlan && steps.step3_vitalBefore; // Infusion needs therapy plan and vital before
    if (step === 5) return steps.step4_infusion; // Materials needs infusion
    if (step === 6) return steps.step5_materials; // Photo needs materials (optional step)
    if (step === 7) return steps.step5_materials; // Vital After needs materials (photo is optional)
    if (step === 8) return steps.step7_vitalAfter; // Complaints & Recommendations needs vital after (optional step)
    if (step === 9) return steps.step7_vitalAfter; // Evaluation needs vital after (step 8 is optional)
    return false;
  };

  // Check if all required steps are complete (photo is optional)
  const allRequiredStepsComplete = 
    steps.step1_diagnosis && 
    steps.step2_therapyPlan && 
    steps.step3_vitalBefore && 
    steps.step4_infusion &&
    steps.step5_materials &&
    steps.step7_vitalAfter &&
    steps.step8_evaluation;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => returnTo ? router.push(returnTo) : router.back()}
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: '16px' }}
        >
          ← Kembali
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
              {sessionInfo.sessionCode}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {sessionInfo.member.fullName} ({sessionInfo.member.memberNo}) • 
              <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                Sesi Global #{sessionInfo.infusKe}
              </span>
              {sessionInfo.branchInfusKe && sessionInfo.branchInfusKe !== sessionInfo.infusKe && (
                <> • Sesi Cabang #{sessionInfo.branchInfusKe}</>
              )}
              {' • '}
              {new Date(sessionInfo.treatmentDate).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </p>
            {sessionInfo.branchName && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                Cabang: <strong>{sessionInfo.branchName}</strong>
                {sessionInfo.branchCode ? ` (${sessionInfo.branchCode})` : ''}
              </p>
            )}
          </div>
          
          {sessionInfo.isCompleted && (
            <span
              className={isCompletionCancelled ? 'badge badge-danger' : 'badge badge-success'}
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              {isCompletionCancelled ? 'Completion Dibatalkan' : 'Sesi Selesai'}
            </span>
          )}
        </div>
      </div>

      {/* Session Details */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              Data Sesi & Paket
            </h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
              <div>
                Pelaksanaan: <strong style={{ color: 'var(--text-primary)' }}>{sessionInfo.pelaksanaan === 'HOME_CARE' ? 'Home Care' : 'On Site'}</strong>
              </div>
              <div>
                Paket dasar: <strong style={{ color: 'var(--text-primary)' }}>{sessionInfo.memberPackage?.packageCode || '-'}</strong>
              </div>
              {sessionInfo.boosterPackage ? (
                <>
                  <div>
                    Booster: <strong style={{ color: 'var(--text-primary)' }}>{sessionInfo.boosterPackage.packageCode}</strong>
                  </div>
                  {sessionInfo.boosterPackage.boosterType && (
                    <div>
                      Jenis booster/stok: <strong style={{ color: 'var(--text-primary)' }}>{sessionInfo.boosterPackage.boosterType}</strong>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  Booster: <strong style={{ color: 'var(--text-primary)' }}>Tidak menggunakan paket booster</strong>
                </div>
              )}
            </div>
            {boosterPackageChangeLocked && (
              <p style={{ color: '#f59e0b', fontSize: '13px', marginTop: '10px' }}>
                Paket booster tidak bisa diganti karena jenis booster/stok sudah digunakan pada sesi ini. Data sesi lain tetap bisa diedit.
              </p>
            )}
          </div>

          {canEditSessionBoosterPackage && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={openBoosterEditModal}
              title="Edit data sesi"
            >
              Edit Data Sesi
            </button>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '700',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: 0
          }}>
            <span style={{ fontSize: '20px' }}>📋</span> Progress Sesi Terapi
          </h3>
          <button
            onClick={() => setShowStaffInfo(!showStaffInfo)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>👥</span>
            <span>{showStaffInfo ? 'Sembunyikan' : 'Lihat'} Info Tim</span>
          </button>
        </div>

        {/* Staff Info Panel */}
        {showStaffInfo && (
          <div style={{
            marginBottom: '20px',
            padding: '20px',
            background: 'var(--surface-input)',
            border: '1px solid var(--surface-border)',
            borderRadius: '12px',
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>👥</span> Tim Medis & Admin
            </h4>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px'
            }}>
              {/* Admin Layanan */}
              <div style={{
                padding: '16px',
                background: 'var(--surface-card)',
                border: '1px solid var(--surface-border)',
                borderRadius: '8px',
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px'
                }}>
                  Admin Layanan
                </div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '18px' }}>👤</span>
                  <span>{sessionInfo.adminLayanan.fullName}</span>
                </div>
              </div>

              {/* Dokter */}
              <div style={{
                padding: '16px',
                background: 'var(--surface-card)',
                border: '1px solid var(--surface-border)',
                borderRadius: '8px',
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px'
                }}>
                  Dokter Utama
                </div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '18px' }}>👨‍⚕️</span>
                  <span>{sessionInfo.doctor.fullName}</span>
                </div>
                {!steps.step8_evaluation && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginTop: '10px',
                    padding: '5px 10px',
                    borderRadius: '999px',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    background: 'rgba(245, 158, 11, 0.13)',
                    color: '#f59e0b',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}>
                    Evaluasi dokter belum diisi
                  </div>
                )}
                {/* Additional Doctors - will be added when backend returns them */}
                {(sessionInfo as any).sessionDoctors && (sessionInfo as any).sessionDoctors.length > 1 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--surface-border)' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      marginBottom: '8px'
                    }}>
                      Dokter Tambahan:
                    </div>
                    {(sessionInfo as any).sessionDoctors
                      .filter((sd: any) => !sd.isPrimary)
                      .map((sd: any) => (
                        <div key={sd.id} style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          marginBottom: '4px',
                          paddingLeft: '26px'
                        }}>
                          • {sd.doctor.profile?.fullName || sd.doctor.fullName}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Nakes */}
              <div style={{
                padding: '16px',
                background: 'var(--surface-card)',
                border: '1px solid var(--surface-border)',
                borderRadius: '8px',
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px'
                }}>
                  Nakes Utama
                </div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '18px' }}>👩‍⚕️</span>
                  <span>{sessionInfo.nurse.fullName}</span>
                </div>
                {/* Additional Nurses - will be added when backend returns them */}
                {(sessionInfo as any).sessionNurses && (sessionInfo as any).sessionNurses.length > 1 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--surface-border)' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      marginBottom: '8px'
                    }}>
                      Nakes Tambahan:
                    </div>
                    {(sessionInfo as any).sessionNurses
                      .filter((sn: any) => !sn.isPrimary)
                      .map((sn: any) => (
                        <div key={sn.id} style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          marginBottom: '4px',
                          paddingLeft: '26px'
                        }}>
                          • {sn.nurse.profile?.fullName || sn.nurse.fullName}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
          gap: '12px' 
        }}>
          <StepIndicator 
            number={1} 
            title="Diagnosis" 
            completed={steps.step1_diagnosis} 
            active={activeStep === 1} 
            onClick={() => canAccessStep(1) && setActiveStep(1)}
            locked={!canAccessStep(1)}
            icon="🩺"
          />
          <StepIndicator 
            number={2} 
            title="Therapy Plan" 
            completed={steps.step2_therapyPlan} 
            active={activeStep === 2} 
            onClick={() => canAccessStep(2) && setActiveStep(2)}
            locked={!canAccessStep(2)}
            icon="📝"
          />
          <StepIndicator 
            number={3} 
            title="Vital Sebelum" 
            completed={steps.step3_vitalBefore} 
            active={activeStep === 3} 
            onClick={() => canAccessStep(3) && setActiveStep(3)}
            locked={!canAccessStep(3)}
            icon="💉"
          />
          <StepIndicator 
            number={4} 
            title="Infus Aktual" 
            completed={steps.step4_infusion} 
            active={activeStep === 4} 
            onClick={() => canAccessStep(4) && setActiveStep(4)}
            locked={!canAccessStep(4)}
            icon="💧"
          />
          <StepIndicator 
            number={5} 
            title="Material Usage" 
            completed={steps.step5_materials} 
            active={activeStep === 5} 
            onClick={() => canAccessStep(5) && setActiveStep(5)}
            locked={!canAccessStep(5)}
            icon="📦"
          />
          <StepIndicator 
            number={6} 
            title="Upload Foto" 
            completed={steps.step6_photo} 
            active={activeStep === 6} 
            onClick={() => canAccessStep(6) && setActiveStep(6)}
            locked={!canAccessStep(6)}
            icon="📸"
            optional={true}
          />
          <StepIndicator 
            number={7} 
            title="Vital Sesudah" 
            completed={steps.step7_vitalAfter} 
            active={activeStep === 7} 
            onClick={() => canAccessStep(7) && setActiveStep(7)}
            locked={!canAccessStep(7)}
            icon="💉"
          />
          <StepIndicator
            number={8}
            title="Keluhan & Rekomendasi"
            completed={session.evaluation?.keluhan || session.evaluation?.rekomendasi ? true : false}
            active={activeStep === 8}
            onClick={() => canAccessStep(8) && setActiveStep(8)}
            locked={!canAccessStep(8)}
            icon="📝"
            optional={true}
          />
          <StepIndicator
            number={9}
            title="Evaluasi Dokter"
            completed={steps.step8_evaluation}
            active={activeStep === 9}
            onClick={() => canAccessStep(9) && setActiveStep(9)}
            locked={!canAccessStep(9)}
            icon="📋"
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="card">
        {activeStep === 1 && (
          <Step1Diagnosis 
            encounterId={sessionInfo.encounterId}
            memberId={session.memberId}
            diagnosis={session.diagnosis}
            isLocked={false}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 2 && (
          <Step2TherapyPlan 
            sessionId={sessionId}
            memberId={session.memberId}
            therapyPlan={session.therapyPlan}
            isLocked={!canAccessStep(2)}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 3 && (
          <Step3VitalBefore 
            sessionId={sessionId}
            vitalSigns={session.vitalSigns.filter(v => v.waktuCatat === 'SEBELUM')}
            isLocked={!canAccessStep(3)}
            onComplete={handleStepComplete}
            onNext={() => setActiveStep(4)}
          />
        )}
        
        {activeStep === 4 && (
          <Step5Infusion 
            sessionId={sessionId}
            memberId={session.memberId}
            therapyPlan={session.therapyPlan}
            infusion={session.infusion}
            isLocked={!canAccessStep(4)}
            onComplete={handleStepComplete}
            onNext={() => setActiveStep(5)}
            onEditTherapyPlanSet={openTherapyPlanEditModal}
          />
        )}
        
        {activeStep === 5 && (
          <Step6Materials 
            sessionId={sessionId}
            branchId={sessionInfo.branchId || ''}
            materials={session.materials || []}
            isLocked={!canAccessStep(5)}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 6 && (
          <Step7Photo 
            sessionId={sessionId}
            photo={session.photo}
            isLocked={!canAccessStep(6)}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 7 && (
          <Step8VitalAfter 
            sessionId={sessionId}
            vitalSigns={session.vitalSigns}
            isLocked={!canAccessStep(7)}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 8 && (
          <Step8ComplaintsRecommendations
            sessionId={sessionId}
            complaintsRecommendations={session.evaluation ? {
              keluhan: session.evaluation.keluhan,
              rekomendasi: session.evaluation.rekomendasi
            } : null}
            isLocked={!canAccessStep(8)}
            onComplete={async () => {
              await handleStepComplete();
              setActiveStep(9);
            }}
          />
        )}

        {activeStep === 9 && (
          <Step9Evaluation 
            sessionId={sessionId}
            evaluation={session.evaluation}
            isLocked={!canAccessStep(9)}
            onComplete={handleStepComplete}
          />
        )}
      </div>

      {/* Session Completed Banner */}
      {sessionInfo.isCompleted && !isCompletionCancelled && (
        <div style={{
          marginTop: '32px',
          padding: '32px',
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.15) 100%)',
          border: '2px solid rgba(34, 197, 94, 0.4)',
          borderRadius: '16px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
          }}>
            ✓
          </div>
          <h3 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#22c55e',
            marginBottom: '8px',
          }}>
            ✅ Sesi Terapi Telah Selesai
          </h3>
          <p style={{
            fontSize: '15px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
          }}>
            Sesi terapi ini telah diselesaikan dan tercatat dalam sistem.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push(`/members/${session.session.member.memberId}`)}
              className="btn btn-secondary"
              style={{ padding: '12px 24px' }}
            >
              Kembali ke Profil Member
            </button>
            {canCancelCompletion && (
              <button
                type="button"
                onClick={() => setShowCancellationModal(true)}
                className="btn btn-danger"
                style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <RotateCcw size={18} />
                Batalkan Completion
              </button>
            )}
          </div>
        </div>
      )}

      {sessionInfo.isCompleted && isCompletionCancelled && (
        <div className="card" style={{ marginTop: '32px', padding: '24px', borderColor: 'rgba(239, 68, 68, 0.45)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444', marginBottom: '8px' }}>
            Completion Dibatalkan
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {sessionInfo.cancellationReason || 'Posting revenue, HPP, dan persediaan telah dibalik.'}
          </p>
        </div>
      )}

      {showCancellationModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(0, 0, 0, 0.68)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Batalkan Completion</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                  Revenue, HPP, dan konsumsi FIFO akan dibalik dalam satu transaksi.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCancellationModal}
                disabled={cancellingCompletion}
                aria-label="Tutup"
                title="Tutup"
                style={{ border: 0, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            <label htmlFor="completion-cancellation-reason" style={{ display: 'block', marginTop: '20px', marginBottom: '8px', fontWeight: 600 }}>
              Alasan pembatalan
            </label>
            <textarea
              id="completion-cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              disabled={cancellingCompletion}
              rows={4}
              maxLength={1000}
              autoFocus
              style={{ width: '100%', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={closeCancellationModal} disabled={cancellingCompletion}>
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancelCompletion}
                disabled={cancellingCompletion || cancellationReason.trim().length < 5}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <RotateCcw size={18} />
                {cancellingCompletion ? 'Membalik posting...' : 'Konfirmasi Pembatalan'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showBoosterEditModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '760px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
                  Edit Data Sesi
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                  Ubah jadwal, pelaksanaan, paket, dan tim yang menangani sesi ini.
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowBoosterEditModal(false)}
                disabled={savingBoosterPackage}
              >
                Tutup
              </button>
            </div>

            {boosterEditError && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                {boosterEditError}
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Tanggal & Jam Terapi
                </label>
                <input
                  type="datetime-local"
                  value={sessionEditTreatmentDate}
                  onChange={(event) => setSessionEditTreatmentDate(event.target.value)}
                  disabled={savingBoosterPackage || loadingBoosterPackages}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Pelaksanaan
                </label>
                <select
                  value={sessionEditPelaksanaan}
                  onChange={(event) => setSessionEditPelaksanaan(event.target.value as 'ON_SITE' | 'HOME_CARE')}
                  disabled={savingBoosterPackage || loadingBoosterPackages}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="ON_SITE">On Site</option>
                  <option value="HOME_CARE">Home Care</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Paket Dasar
                </label>
                <select
                  value={sessionEditMemberPackageId}
                  onChange={(event) => setSessionEditMemberPackageId(event.target.value)}
                  disabled={savingBoosterPackage || loadingBoosterPackages}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">{loadingBoosterPackages ? 'Memuat paket...' : 'Pilih paket dasar'}</option>
                  {basicPackages.map((pkg) => (
                    <option key={pkg.packageId} value={pkg.packageId}>
                      {formatPackageLabel(pkg)}
                    </option>
                  ))}
                </select>
                {!loadingBoosterPackages && basicPackages.length === 0 && (
                  <p style={{ color: '#f59e0b', fontSize: '13px', marginTop: '8px' }}>
                    Tidak ada paket dasar aktif dengan sisa sesi untuk cabang ini.
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Nomor Sesi Global
                </label>
                <input
                  type="number"
                  min="1"
                  value={sessionEditInfusKe}
                  onChange={(event) => setSessionEditInfusKe(event.target.value ? Number(event.target.value) : '')}
                  disabled={savingBoosterPackage || loadingBoosterPackages}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                />
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>
                  Urutan sesi member di semua cabang.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Nomor Sesi Cabang
                </label>
                <input
                  type="number"
                  min="1"
                  value={sessionEditBranchInfusKe}
                  onChange={(event) => setSessionEditBranchInfusKe(event.target.value ? Number(event.target.value) : '')}
                  disabled={savingBoosterPackage || loadingBoosterPackages}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                />
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>
                  Urutan sesi member khusus di cabang ini.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Admin Layanan
                </label>
                <select
                  value={sessionEditAdminLayananId}
                  onChange={(event) => setSessionEditAdminLayananId(event.target.value)}
                  disabled={savingBoosterPackage || loadingBoosterPackages}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Pilih admin layanan</option>
                  {adminLayananOptions.map((staff) => (
                    <option key={staff.userId} value={staff.userId}>
                      {staff.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Dokter Utama
                </label>
                <select
                  value={sessionEditDoctorId}
                  onChange={(event) => {
                    setSessionEditDoctorId(event.target.value);
                    setSessionEditAdditionalDoctorIds((ids) => ids.filter((id) => id !== event.target.value));
                  }}
                  disabled={savingBoosterPackage || loadingBoosterPackages}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Pilih dokter</option>
                  {doctorOptions.map((staff) => (
                    <option key={staff.userId} value={staff.userId}>
                      {staff.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Nakes Utama
                </label>
                <select
                  value={sessionEditNurseId}
                  onChange={(event) => {
                    setSessionEditNurseId(event.target.value);
                    setSessionEditAdditionalNurseIds((ids) => ids.filter((id) => id !== event.target.value));
                  }}
                  disabled={savingBoosterPackage || loadingBoosterPackages}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Pilih nakes</option>
                  {nurseOptions.map((staff) => (
                    <option key={staff.userId} value={staff.userId}>
                      {staff.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginTop: '16px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              background: 'rgba(245, 158, 11, 0.08)',
              cursor: savingBoosterPackage || loadingBoosterPackages ? 'not-allowed' : 'pointer',
            }}>
              <input
                type="checkbox"
                checked={sessionEditShiftFollowing}
                onChange={(event) => setSessionEditShiftFollowing(event.target.checked)}
                disabled={savingBoosterPackage || loadingBoosterPackages}
                style={{ marginTop: '3px' }}
              />
              <span>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Update maju jika nomor sudah dipakai
                </span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  Jika nomor target bentrok, sesi lain pada nomor tersebut dan setelahnya akan digeser +1. Jika tidak dicentang, sistem menolak duplikasi.
                </span>
              </span>
            </label>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginTop: '18px',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Dokter Tambahan
                </label>
                <div style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  padding: '12px',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '10px',
                  background: 'var(--surface-input)',
                }}>
                  {doctorOptions.filter((staff) => staff.userId !== sessionEditDoctorId).map((staff) => (
                    <label key={staff.userId} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={sessionEditAdditionalDoctorIds.includes(staff.userId)}
                        onChange={() => setSessionEditAdditionalDoctorIds((ids) => toggleSelectedId(ids, staff.userId))}
                        disabled={savingBoosterPackage || loadingBoosterPackages}
                      />
                      {staff.fullName}
                    </label>
                  ))}
                  {doctorOptions.filter((staff) => staff.userId !== sessionEditDoctorId).length === 0 && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Tidak ada opsi tambahan.</span>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Nakes Tambahan
                </label>
                <div style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  padding: '12px',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '10px',
                  background: 'var(--surface-input)',
                }}>
                  {nurseOptions.filter((staff) => staff.userId !== sessionEditNurseId).map((staff) => (
                    <label key={staff.userId} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={sessionEditAdditionalNurseIds.includes(staff.userId)}
                        onChange={() => setSessionEditAdditionalNurseIds((ids) => toggleSelectedId(ids, staff.userId))}
                        disabled={savingBoosterPackage || loadingBoosterPackages}
                      />
                      {staff.fullName}
                    </label>
                  ))}
                  {nurseOptions.filter((staff) => staff.userId !== sessionEditNurseId).length === 0 && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Tidak ada opsi tambahan.</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '20px',
              paddingTop: '18px',
              borderTop: '1px solid var(--surface-border)',
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '14px',
                cursor: savingBoosterPackage || boosterPackageChangeLocked ? 'not-allowed' : 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={boosterEditUseBooster}
                  onChange={(event) => {
                    setBoosterEditUseBooster(event.target.checked);
                    if (!event.target.checked) setBoosterEditPackageId('');
                  }}
                  disabled={savingBoosterPackage || loadingBoosterPackages || boosterPackageChangeLocked}
                />
                Gunakan paket booster untuk sesi ini
              </label>

              {boosterPackageChangeLocked && (
                <p style={{ color: '#f59e0b', fontSize: '13px', marginTop: '-6px', marginBottom: '14px' }}>
                  Paket booster terkunci karena jenis booster/stok sudah dipakai.
                </p>
              )}

              {boosterEditUseBooster && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                    Paket Booster
                  </label>
                  <select
                    value={boosterEditPackageId}
                    onChange={(event) => setBoosterEditPackageId(event.target.value)}
                    disabled={savingBoosterPackage || loadingBoosterPackages || boosterPackageChangeLocked}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--surface-border)',
                      background: 'var(--surface-input)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">
                      {loadingBoosterPackages ? 'Memuat paket booster...' : 'Pilih paket booster'}
                    </option>
                    {boosterPackages.map((pkg) => (
                      <option
                        key={pkg.packageId}
                        value={pkg.packageId}
                        disabled={!!pkg.disabledReason}
                      >
                        {formatPackageLabel(pkg)}
                        {pkg.disabledReason ? ` - tidak bisa dipakai: ${pkg.disabledReason}` : ''}
                      </option>
                    ))}
                  </select>
                  {!loadingBoosterPackages && boosterPackages.length === 0 && (
                    <p style={{ color: '#f59e0b', fontSize: '13px', marginTop: '8px' }}>
                      Tidak ada paket booster yang tercatat untuk member ini.
                    </p>
                  )}
                  {!loadingBoosterPackages &&
                    boosterPackages.length > 0 &&
                    boosterPackages.every((pkg) => pkg.disabledReason) && (
                    <p style={{ color: '#f59e0b', fontSize: '13px', marginTop: '8px' }}>
                      Paket booster ditemukan, tetapi belum ada yang bisa dipakai untuk sesi ini. Cek status, sisa sesi, atau cabang pada opsi di atas.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowBoosterEditModal(false)}
                disabled={savingBoosterPackage}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveBoosterPackage}
                disabled={savingBoosterPackage || loadingBoosterPackages}
              >
                {savingBoosterPackage ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTherapyPlanEditModal && therapyPlanSetForEdit.length > 0 && (
        <EditTherapyPlanSetModal
          isOpen={showTherapyPlanEditModal}
          onClose={() => {
            setShowTherapyPlanEditModal(false);
            setTherapyPlanSetForEdit([]);
          }}
          memberId={session.memberId}
          therapyPlans={therapyPlanSetForEdit}
          editableSessionId={sessionId}
          onSuccess={handleTherapyPlanEditSuccess}
        />
      )}

      {/* Floating Sticky Button - Always visible when scrolling */}
      {!sessionInfo.isCompleted && allRequiredStepsComplete && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
        }}>
          <button
            onClick={handleCompleteSession}
            disabled={completing}
            style={{
              padding: '18px 32px',
              fontSize: '16px',
              fontWeight: '700',
              color: 'white',
              background: completing 
                ? 'rgba(34, 197, 94, 0.5)'
                : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              borderRadius: '16px',
              cursor: completing ? 'not-allowed' : 'pointer',
              boxShadow: completing 
                ? 'none'
                : '0 8px 32px rgba(34, 197, 94, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'floatingButtonPulse 2s infinite',
            }}
            onMouseEnter={(e) => {
              if (!completing) {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(34, 197, 94, 0.6), 0 6px 16px rgba(0, 0, 0, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!completing) {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(34, 197, 94, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)';
              }
            }}
          >
            {completing ? (
              <>
                <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '24px' }}>✅</span>
                <span>SELESAIKAN SESI</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* CSS Animation for floating button */}
      <style jsx>{`
        @keyframes floatingButtonPulse {
          0%, 100% {
            box-shadow: 0 8px 32px rgba(34, 197, 94, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          50% {
            box-shadow: 0 8px 40px rgba(34, 197, 94, 0.7), 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 10px rgba(34, 197, 94, 0.2);
          }
        }
      `}</style>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ 
  number, 
  title, 
  completed, 
  active, 
  locked,
  icon,
  optional,
  onClick 
}: { 
  number: number; 
  title: string; 
  completed: boolean; 
  active?: boolean;
  locked?: boolean;
  icon?: string;
  optional?: boolean;
  onClick?: () => void;
}) {
  const getStatusColor = () => {
    if (locked) return 'rgba(148, 163, 184, 0.3)';
    if (completed) return '#22c55e';
    if (active) return '#3b82f6';
    return 'rgba(148, 163, 184, 0.5)';
  };

  const getBackgroundColor = () => {
    if (locked) return 'rgba(148, 163, 184, 0.05)';
    if (completed) return 'rgba(34, 197, 94, 0.1)';
    if (active) return 'rgba(59, 130, 246, 0.1)';
    return 'rgba(148, 163, 184, 0.05)';
  };

  return (
    <div
      onClick={locked ? undefined : onClick}
      style={{
        padding: '16px',
        borderRadius: '12px',
        border: `2px solid ${getStatusColor()}`,
        background: getBackgroundColor(),
        cursor: locked ? 'not-allowed' : (onClick ? 'pointer' : 'default'),
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        opacity: locked ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (onClick && !locked) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 8px 16px ${getStatusColor()}40`;
        }
      }}
      onMouseLeave={(e) => {
        if (onClick && !locked) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
      title={locked ? 'Selesaikan step sebelumnya terlebih dahulu' : (optional ? 'Step ini bersifat opsional' : '')}
    >
      {completed && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#22c55e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
        }}>
          ✓
        </div>
      )}
      
      {locked && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'rgba(148, 163, 184, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
        }}>
          🔒
        </div>
      )}

      {optional && !completed && !locked && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '2px 6px',
          borderRadius: '4px',
          background: 'rgba(251, 191, 36, 0.2)',
          fontSize: '10px',
          fontWeight: '600',
          color: '#fbbf24',
        }}>
          OPSIONAL
        </div>
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: locked
            ? 'rgba(148, 163, 184, 0.2)'
            : completed 
            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
            : active 
            ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
            : 'rgba(148, 163, 184, 0.2)',
          color: (completed || active) && !locked ? 'white' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: completed ? '18px' : '16px',
          fontWeight: '700',
          flexShrink: 0,
          boxShadow: (completed || active) && !locked ? `0 4px 12px ${getStatusColor()}40` : 'none',
        }}>
          {completed ? '✓' : icon || number}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: 'var(--text-muted)',
            marginBottom: '2px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Step {number} {optional && '(Opsional)'}
          </div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '600',
            color: locked ? 'var(--text-muted)' : (completed || active ? 'var(--text-primary)' : 'var(--text-secondary)'),
            lineHeight: '1.2',
          }}>
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}
