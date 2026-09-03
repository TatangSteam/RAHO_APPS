'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import { memberApi, type MemberPackage } from '@/lib/memberApi';
import { usersApi, type StaffMember } from '@/lib/usersApi';
import { therapyPlanApi, type TherapyPlan } from '@/lib/therapyPlanApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { getApiErrorMessage } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/clientIdempotencyKey';
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
import WhatsAppReportCard from '@/components/sessions/WhatsAppReportCard';
import { SessionWorkflowDraftProvider, type SessionDraftKey } from '@/components/sessions/SessionWorkflowDraftContext';
import {
  SESSION_STEP_OWNER,
  buildCompletionSummary,
  canActivateSessionMaterials,
  canEditSessionStep,
  canFinalizeSession,
  getDeviceClass,
  getMissingRequiredSteps,
} from '@/components/sessions/sessionWorkflow';
import EditTherapyPlanSetModal from '@/components/therapy-plan/EditTherapyPlanSetModal';
import { RotateCcw, X } from 'lucide-react';
import styles from './page.module.css';

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

const getPackageId = (pkg: { packageId?: string; id?: string }) => pkg.packageId || pkg.id || '';

const flattenMemberPackages = (packages: MemberPackage[]): BoosterPackageOption[] => {
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

const mergeStaffOptions = (
  options: StaffMember[],
  current?: { userId: string; fullName: string; staffCode?: string | null } | null,
) => {
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
  const [inventorySource, setInventorySource] = useState<'' | 'BRANCH' | 'TEAM'>('');
  const completionInFlightRef = useRef(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationKey, setCancellationKey] = useState('');
  const [cancellingCompletion, setCancellingCompletion] = useState(false);
  const [activatingMaterials, setActivatingMaterials] = useState(false);
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
  const [postedEditReason, setPostedEditReason] = useState('');
  const [postedEditConfirmed, setPostedEditConfirmed] = useState(false);
  const [workflowDrafts, setWorkflowDrafts] = useState<Record<string, unknown>>({});
  const workflowRevisionRef = useRef(0);
  const workflowDraftsRef = useRef<Record<string, unknown>>({});
  const workflowSaveInFlightRef = useRef(false);
  const workflowDirtyRef = useRef(false);
  const [workflowSaveState, setWorkflowSaveState] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'CONFLICT' | 'ERROR'>('IDLE');
  const [workflowSavedAt, setWorkflowSavedAt] = useState<string | null>(null);
  const [editClock, setEditClock] = useState(() => Date.now());
  const [showCompletionReview, setShowCompletionReview] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const metricsRef = useRef({
    startedAt: new Date().toISOString(),
    activeSeconds: 0,
    stepSeconds: {} as Record<string, number>,
    stepTransitions: 0,
    validationErrors: 0,
    retryCount: 0,
  });
  const activeStepTimingRef = useRef({ step: 1, startedAt: Date.now() });
  const pageVisibleRef = useRef(true);

  const loadSessionDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sessionApi.getSessionById(sessionId);
      setSession(data);
      const serverDrafts = data.workflow?.drafts || {};
      setWorkflowDrafts(serverDrafts);
      workflowDraftsRef.current = serverDrafts;
      const revision = data.workflow?.revision || 0;
      workflowRevisionRef.current = revision;
      setWorkflowSavedAt(data.workflow?.savedAt || null);
      workflowDirtyRef.current = false;
      
      // Auto-select the first incomplete step owned by the current role. A
      // server-saved step is restored when it is still editable by this user.
      if (data.steps && data.steps.step1_diagnosis) {
        setActiveStep((currentStep) => {
          if (currentStep !== 1) return currentStep;
          const savedStep = data.workflow?.activeStep;
          if (savedStep && canEditSessionStep(user?.role, savedStep)) return savedStep;
          const incompleteSteps = [
            !data.steps?.step2_therapyPlan ? 2 : null,
            !data.steps?.step3_vitalBefore ? 3 : null,
            !data.steps?.step4_infusion ? 4 : null,
            !data.steps?.step5_materials ? 5 : null,
            !data.steps?.step7_vitalAfter ? 7 : null,
            !data.steps?.step8_evaluation ? 9 : null,
          ].filter((step): step is number => step !== null);
          const ownedStep = incompleteSteps.find((step) => canEditSessionStep(user?.role, step));
          if (ownedStep) return ownedStep;
          if (incompleteSteps.length > 0) return incompleteSteps[0];
          return currentStep;
        });
      }
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading session detail:', error);
      const errorMessage = error.response?.data?.error?.message || 'Gagal memuat detail sesi';
      showToast.error(errorMessage);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router, sessionId, user?.role]);

  useEffect(() => {
    void loadSessionDetail();
  }, [loadSessionDetail]);

  useEffect(() => {
    if (!session?.session.isCompleted) return;
    const timer = window.setInterval(() => setEditClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [session?.session.isCompleted]);

  const updateWorkflowDraft = useCallback((key: SessionDraftKey, value: unknown) => {
    const next = { ...workflowDraftsRef.current, [key]: value };
    workflowDraftsRef.current = next;
    setWorkflowDrafts(next);
    workflowDirtyRef.current = true;
    setWorkflowSaveState('IDLE');
  }, []);

  const clearWorkflowDraft = useCallback((key: SessionDraftKey) => {
    const next = { ...workflowDraftsRef.current };
    delete next[key];
    workflowDraftsRef.current = next;
    setWorkflowDrafts(next);
    workflowDirtyRef.current = true;
  }, []);

  const saveWorkflowProgress = useCallback(async (force = false): Promise<boolean> => {
    if (!session || session.session.isCompleted) return true;
    if (workflowSaveInFlightRef.current) return false;
    if (!force && !workflowDirtyRef.current) return true;
    workflowSaveInFlightRef.current = true;
    setWorkflowSaveState('SAVING');
    const now = Date.now();
    const timing = activeStepTimingRef.current;
    const elapsed = pageVisibleRef.current
      ? Math.max(0, Math.round((now - timing.startedAt) / 1000))
      : 0;
    const metrics = metricsRef.current;
    const stepSeconds = {
      ...metrics.stepSeconds,
      [String(timing.step)]: (metrics.stepSeconds[String(timing.step)] || 0) + elapsed,
    };
    try {
      const result = await sessionApi.saveProgress(sessionId, {
        activeStep,
        drafts: workflowDraftsRef.current,
        expectedRevision: workflowRevisionRef.current,
        metrics: {
          ...metrics,
          activeSeconds: metrics.activeSeconds + elapsed,
          stepSeconds,
          deviceClass: typeof window === 'undefined' ? 'UNKNOWN' : getDeviceClass(window.innerWidth),
        },
      });
      metrics.activeSeconds += elapsed;
      metrics.stepSeconds = stepSeconds;
      activeStepTimingRef.current = { step: activeStep, startedAt: now };
      workflowRevisionRef.current = result.revision;
      setWorkflowSavedAt(result.savedAt);
      workflowDirtyRef.current = false;
      setWorkflowSaveState('SAVED');
      return true;
    } catch (error) {
      assertCaughtError(error);
      const code = error.response?.data?.error?.code;
      setWorkflowSaveState(code === 'SESSION_WORKFLOW_CONFLICT' ? 'CONFLICT' : 'ERROR');
      if (code === 'SESSION_WORKFLOW_CONFLICT') {
        setCompletionError('Sesi berubah di perangkat atau oleh pengguna lain. Muat ulang sebelum melanjutkan.');
      }
      return false;
    } finally {
      workflowSaveInFlightRef.current = false;
    }
  }, [activeStep, session, sessionId]);

  const handleStepComplete = useCallback(async () => {
    for (let attempt = 0; workflowSaveInFlightRef.current && attempt < 50; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    const saved = await saveWorkflowProgress(true);
    if (saved) await loadSessionDetail();
  }, [loadSessionDetail, saveWorkflowProgress]);

  useEffect(() => {
    if (!workflowDirtyRef.current) return;
    const timer = window.setTimeout(() => void saveWorkflowProgress(), 1500);
    return () => window.clearTimeout(timer);
  }, [workflowDrafts, activeStep, saveWorkflowProgress]);

  useEffect(() => {
    const previous = activeStepTimingRef.current;
    if (previous.step === activeStep) return;
    const elapsed = Math.max(0, Math.round((Date.now() - previous.startedAt) / 1000));
    metricsRef.current.activeSeconds += elapsed;
    metricsRef.current.stepSeconds[String(previous.step)] =
      (metricsRef.current.stepSeconds[String(previous.step)] || 0) + elapsed;
    metricsRef.current.stepTransitions += 1;
    activeStepTimingRef.current = { step: activeStep, startedAt: Date.now() };
    workflowDirtyRef.current = true;
  }, [activeStep]);

  useEffect(() => {
    const handleVisibility = () => {
      const now = Date.now();
      if (document.hidden && pageVisibleRef.current) {
        const timing = activeStepTimingRef.current;
        const elapsed = Math.max(0, Math.round((now - timing.startedAt) / 1000));
        metricsRef.current.activeSeconds += elapsed;
        metricsRef.current.stepSeconds[String(timing.step)] =
          (metricsRef.current.stepSeconds[String(timing.step)] || 0) + elapsed;
      }
      pageVisibleRef.current = !document.hidden;
      activeStepTimingRef.current = { step: activeStep, startedAt: now };
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeStep]);

  useEffect(() => {
    if (!session || session.session.isCompleted) return;
    const timer = window.setInterval(() => {
      if (!pageVisibleRef.current) return;
      workflowDirtyRef.current = true;
      void saveWorkflowProgress(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [saveWorkflowProgress, session]);

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
    } catch (error) {
      assertCaughtError(error);
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
    setPostedEditReason('');
    setPostedEditConfirmed(false);
    setSessionEditMemberPackageId(session.session.memberPackage?.packageId || '');
    setSessionEditTreatmentDate(toDateTimeLocalValue(session.session.treatmentDate));
    setSessionEditPelaksanaan(session.session.pelaksanaan);
    setSessionEditAdminLayananId(session.session.adminLayanan?.userId || '');
    setSessionEditDoctorId(session.session.doctor?.userId || '');
    setSessionEditNurseId(session.session.nurse?.userId || '');
    setSessionEditInfusKe(session.session.infusKe || '');
    setSessionEditBranchInfusKe(session.session.branchInfusKe || session.session.infusKe || '');
    setSessionEditShiftFollowing(false);
    setSessionEditAdditionalDoctorIds(
      (session.session.sessionDoctors || [])
        .filter((assignment) => !assignment.isPrimary && assignment.doctor?.userId)
        .map((assignment) => assignment.doctor.userId)
    );
    setSessionEditAdditionalNurseIds(
      (session.session.sessionNurses || [])
        .filter((assignment) => !assignment.isPrimary && assignment.nurse?.userId)
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
      const availableBasics = flatPackages.filter((pkg) => {
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
        .filter((pkg) => pkg.packageType === 'BOOSTER')
        .map((pkg) => {
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
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading session edit data:', error);
      setBoosterEditError(error.response?.data?.error?.message || 'Gagal memuat data edit sesi');
    } finally {
      setLoadingBoosterPackages(false);
    }
  };

  const handleSaveBoosterPackage = async () => {
    if (!session) return;

    if (!sessionEditTreatmentDate) {
      setBoosterEditError('Tanggal terapi wajib diisi');
      return;
    }

    if (!sessionEditMemberPackageId) {
      setBoosterEditError('Pilih paket dasar terlebih dahulu');
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

    if (session.session.isCompleted && postedEditReason.trim().length < 5) {
      setBoosterEditError('Alasan koreksi sesi posted wajib diisi minimal 5 karakter');
      return;
    }

    if (session.session.isCompleted && !postedEditConfirmed) {
      setBoosterEditError('Konfirmasi reversal posting sebelum menyimpan perubahan');
      return;
    }

    let reopenedForEditing = false;
    try {
      setSavingBoosterPackage(true);
      setBoosterEditError(null);
      if (session.session.isCompleted) {
        await sessionApi.cancelCompletion(sessionId, {
          idempotencyKey: createClientIdempotencyKey(),
          reason: postedEditReason.trim(),
          reopenForEditing: true,
        });
        reopenedForEditing = true;
      }
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
        ...(!session.session.isCompleted && session.session.boosterPackage?.boosterType
          ? {}
          : {
              useBooster: boosterEditUseBooster,
              boosterPackageId: boosterEditUseBooster ? boosterEditPackageId : null,
            }),
      });

      showToast.success(reopenedForEditing
        ? 'Posting lama sudah dibalik dan data sesi diperbarui. Selesaikan kembali sesi untuk membuat posting baru.'
        : 'Data sesi berhasil diperbarui');
      setShowBoosterEditModal(false);
      await loadSessionDetail();
    } catch (error) {
      assertCaughtError(error);
      devError('Error updating session details:', error);
      const message = error.response?.data?.error?.message || 'Gagal memperbarui data sesi';
      setBoosterEditError(reopenedForEditing
        ? `Posting lama sudah berhasil dibalik, tetapi perubahan data belum tersimpan: ${message}. Sesi sekarang berstatus pending dan aman untuk diedit ulang.`
        : message);
      if (reopenedForEditing || session.session.isCompleted) await loadSessionDetail();
    } finally {
      setSavingBoosterPackage(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!session || completionInFlightRef.current) return;

    if (!session.session.skipInventoryConsumption && !inventorySource) {
      metricsRef.current.validationErrors += 1;
      showToast.error('Pilih Stok Cabang atau Stok Tim terlebih dahulu');
      return;
    }

    const { steps } = session;
    
    // Validate required steps
    if (!steps.step1_diagnosis) {
      metricsRef.current.validationErrors += 1;
      showToast.error('Diagnosis belum diisi');
      return;
    }
    if (!steps.step2_therapyPlan) {
      metricsRef.current.validationErrors += 1;
      showToast.error('Therapy Plan belum diisi');
      return;
    }
    if (!steps.step3_vitalBefore) {
      metricsRef.current.validationErrors += 1;
      showToast.error('Tanda vital SEBELUM belum diisi');
      return;
    }
    if (!steps.step4_infusion) {
      metricsRef.current.validationErrors += 1;
      showToast.error('Infus aktual belum dibuat');
      return;
    }
    if (!steps.step5_materials) {
      metricsRef.current.validationErrors += 1;
      showToast.error('Material usage belum dicatat');
      return;
    }
    if (!steps.step7_vitalAfter) {
      metricsRef.current.validationErrors += 1;
      showToast.error('Tanda vital SESUDAH belum diisi');
      return;
    }
    if (!steps.step8_evaluation) {
      metricsRef.current.validationErrors += 1;
      showToast.error('Evaluasi dokter belum diisi');
      return;
    }

    completionInFlightRef.current = true;
    try {
      setCompleting(true);
      setCompletionError(null);
      const progressSaved = await saveWorkflowProgress(true);
      if (!progressSaved) {
        throw new Error('Draft belum dapat disimpan. Muat ulang atau coba kembali sebelum completion.');
      }
      const result = await sessionApi.completeSession(sessionId, {
        inventorySource: session.session.skipInventoryConsumption ? 'BRANCH' : (inventorySource || 'BRANCH'),
        expectedWorkflowRevision: workflowRevisionRef.current,
      });
      showToast.success(result.message);
      router.push(`/members/${session.session.member.memberId}`);
    } catch (error) {
      assertCaughtError(error);
      devError('Error completing session:', error);
      const message = getApiErrorMessage(error) || 'Gagal menyelesaikan sesi';
      setCompletionError(message);
      setShowCompletionReview(true);
      showToast.error(message);
    } finally {
      completionInFlightRef.current = false;
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
    const idempotencyKey = cancellationKey || createClientIdempotencyKey();
    if (!cancellationKey) setCancellationKey(idempotencyKey);
    try {
      setCancellingCompletion(true);
      const result = await sessionApi.cancelCompletion(sessionId, { idempotencyKey, reason });
      showToast.success(result.message);
      setShowCancellationModal(false);
      setCancellationReason('');
      setCancellationKey('');
      await loadSessionDetail();
    } catch (error) {
      assertCaughtError(error);
      devError('Error cancelling treatment completion:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal membatalkan completion sesi');
    } finally {
      setCancellingCompletion(false);
    }
  };

  const handleActivateMaterials = async () => {
    if (!session || activatingMaterials) return;

    const confirmed = window.confirm(
      'Aktifkan pencatatan material dan stok untuk sesi ini? Komponen wajib akan dibuat sebagai draft. Stok baru berkurang saat sesi diselesaikan.',
    );
    if (!confirmed) return;

    try {
      setActivatingMaterials(true);
      const result = await sessionApi.activateSessionMaterials(sessionId);
      showToast.success(result.message);
      await loadSessionDetail();
      setActiveStep(5);
    } catch (error) {
      assertCaughtError(error);
      devError('Error activating session materials:', error);
      showToast.error(getApiErrorMessage(error) || 'Gagal mengaktifkan material sesi');
    } finally {
      setActivatingMaterials(false);
    }
  };

  // Workflow autosave re-renders this page for every draft change. Keep the
  // filtered prop stable so the vital form does not reset while users type.
  const vitalSignsBefore = useMemo(
    () => session?.vitalSigns.filter((vital) => vital.waktuCatat === 'SEBELUM') ?? [],
    [session?.vitalSigns],
  );

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
  const sessionEditFieldDisabled = savingBoosterPackage || loadingBoosterPackages;
  const canCancelCompletion = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(user?.role || '');
  const userCanFinalize = canFinalizeSession(user?.role);
  const userCanActivateMaterials = canActivateSessionMaterials(user?.role, user?.userId, sessionInfo);
  const isCompletionCancelled = sessionInfo.completionStatus === 'CANCELLED';
  const correctionDeadline = sessionInfo.completedAt
    ? new Date(sessionInfo.completedAt).getTime() + (4 * 60 * 60 * 1000)
    : null;
  const correctionRemainingMs = correctionDeadline ? Math.max(0, correctionDeadline - editClock) : 0;
  const correctionWindowOpen = !sessionInfo.isCompleted || correctionRemainingMs > 0;
  const correctionTotalMinutes = Math.ceil(correctionRemainingMs / 60_000);
  const correctionHours = Math.floor(correctionTotalMinutes / 60);
  const correctionMinutes = correctionTotalMinutes % 60;
  const postCompletionEditableSteps = new Set([1, 3, 7, 8, 9]);
  const canEditStepNow = (step: number) => (
    canEditSessionStep(user?.role, step)
    && correctionWindowOpen
    && (!sessionInfo.isCompleted || postCompletionEditableSteps.has(step))
  );
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
  const completionSummary = buildCompletionSummary(session);
  const missingRequiredSteps = getMissingRequiredSteps(steps);
  const skipsInventory = Boolean(session.session.skipInventoryConsumption);
  const sessionPhases = [
    { label: 'Persiapan', range: 'Langkah 1–3', active: activeStep <= 3 },
    { label: 'Pelaksanaan', range: 'Langkah 4–6', active: activeStep >= 4 && activeStep <= 6 },
    { label: 'Setelah Terapi', range: 'Langkah 7–8', active: activeStep >= 7 && activeStep <= 8 },
    { label: 'Evaluasi', range: 'Langkah 9', active: activeStep === 9 },
  ];

  return (
    <div className={styles.page}>
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

      <div style={{
        marginBottom: '24px',
        padding: '14px 18px',
        borderRadius: '12px',
        border: `1px solid ${correctionWindowOpen ? 'rgba(245,158,11,0.45)' : 'rgba(148,163,184,0.35)'}`,
        background: correctionWindowOpen ? 'rgba(245,158,11,0.08)' : 'rgba(148,163,184,0.08)',
        color: correctionWindowOpen ? '#fbbf24' : 'var(--text-secondary)',
        fontSize: '13px',
        lineHeight: 1.6,
      }}>
        <strong>{sessionInfo.isCompleted ? (correctionWindowOpen ? 'Masa koreksi masih aktif' : 'Masa koreksi sudah berakhir') : 'Informasi koreksi sesi'}</strong>
        <div>
          {sessionInfo.isCompleted
            ? correctionWindowOpen
              ? `Data sesi dapat dikoreksi oleh role yang diizinkan selama ${correctionHours} jam ${correctionMinutes} menit lagi. Semua perubahan direkam dalam Audit Log.`
              : 'Batas edit 4 jam telah lewat. Koreksi berikutnya harus melalui Admin Manager dan prosedur koreksi formal.'
            : 'Setelah sesi diselesaikan, Nakes/MSO dapat mengoreksi data operasional dan dokter dapat mengoreksi evaluasi dokter selama 4 jam. Semua perubahan direkam.'}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div className={styles.progressHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
          {!sessionInfo.isCompleted && (
            <div style={{ marginLeft: 'auto', fontSize: '12px', color: workflowSaveState === 'CONFLICT' || workflowSaveState === 'ERROR' ? '#ef4444' : 'var(--text-secondary)' }}>
              {workflowSaveState === 'SAVING' && 'Menyimpan draft...'}
              {workflowSaveState === 'SAVED' && workflowSavedAt && `Draft tersimpan ${new Date(workflowSavedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
              {workflowSaveState === 'CONFLICT' && 'Konflik perubahan — muat ulang'}
              {workflowSaveState === 'ERROR' && 'Draft belum tersimpan'}
              {workflowSaveState === 'IDLE' && 'Draft tersimpan otomatis'}
            </div>
          )}
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
              <span>👥</span> Tim Dokter & Operasional
            </h4>
            
            <div className={styles.staffGrid} style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px'
            }}>
              {/* MSO dan Nakes */}
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
                  MSO & Nakes
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
                  <strong style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>MSO</strong>
                  <span>{sessionInfo.adminLayanan?.fullName || 'Data MSO lama tidak tersedia'}</span>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--surface-border)' }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '18px' }}>👩‍⚕️</span>
                    <strong style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nakes Utama</strong>
                    <span>{sessionInfo.nurse?.fullName || 'Data nakes lama tidak tersedia'}</span>
                  </div>
                  {(sessionInfo.sessionNurses?.length || 0) > 1 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Nakes Tambahan:
                      </div>
                      {sessionInfo.sessionNurses
                        ?.filter((assignment) => !assignment.isPrimary && assignment.nurse)
                        .map((assignment) => (
                          <div key={assignment.id} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', paddingLeft: '26px' }}>
                            • {assignment.nurse.fullName || 'Data nakes lama tidak tersedia'}
                          </div>
                        ))}
                    </div>
                  )}
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
                  <span>{sessionInfo.doctor?.fullName || 'Data dokter lama tidak tersedia'}</span>
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
                {(sessionInfo.sessionDoctors?.length || 0) > 1 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--surface-border)' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      marginBottom: '8px'
                    }}>
                      Dokter Tambahan:
                    </div>
                    {sessionInfo.sessionDoctors
                      ?.filter((assignment) => !assignment.isPrimary && assignment.doctor)
                      .map((assignment) => (
                        <div key={assignment.id} style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          marginBottom: '4px',
                          paddingLeft: '26px'
                        }}>
                          • {assignment.doctor.fullName || 'Data dokter lama tidak tersedia'}
                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        <div className={styles.phaseGrid} aria-label="Tahapan utama sesi terapi">
          {sessionPhases.map((phase) => (
            <div
              key={phase.label}
              className={`${styles.phaseItem} ${phase.active ? styles.phaseActive : ''}`}
            >
              <span>{phase.label}</span>
              <small>{phase.range}</small>
            </div>
          ))}
        </div>

        <p className={styles.stepHint}>
          Pilih langkah di bawah. Sistem mengunci langkah yang belum siap agar urutan pengisian tetap aman.
        </p>

        <div className={styles.stepGrid} style={{
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
        {!canEditStepNow(activeStep) && (
          <div style={{ margin: '16px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.35)', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Langkah ini merupakan tanggung jawab <strong>{SESSION_STEP_OWNER[activeStep]}</strong>. Anda dapat melihat statusnya, tetapi tidak dapat mengubah isian.
          </div>
        )}
        <SessionWorkflowDraftProvider
          drafts={workflowDrafts}
          updateDraft={updateWorkflowDraft}
          clearDraft={clearWorkflowDraft}
        >
        {activeStep === 1 && (
          <Step1Diagnosis 
            encounterId={sessionInfo.encounterId}
            memberId={session.memberId}
            diagnosis={session.diagnosis}
            isLocked={!canEditStepNow(1)}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 2 && (
          <Step2TherapyPlan 
            sessionId={sessionId}
            memberId={session.memberId}
            therapyPlan={session.therapyPlan}
            isLocked={!canAccessStep(2) || !canEditStepNow(2)}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 3 && (
          <Step3VitalBefore 
            sessionId={sessionId}
            vitalSigns={vitalSignsBefore}
            isLocked={!canAccessStep(3) || !canEditStepNow(3)}
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
            isLocked={!canAccessStep(4) || !canEditStepNow(4)}
            onComplete={handleStepComplete}
            onNext={() => setActiveStep(5)}
            onEditTherapyPlanSet={openTherapyPlanEditModal}
          />
        )}
        
        {activeStep === 5 && skipsInventory && (
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '8px' }}>Material tidak digunakan</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)' }}>
              Sesi terapi lama ini dibuat dengan pilihan tanpa stok. Material tidak dicatat dan inventory tidak akan berkurang.
            </p>
            {!sessionInfo.isCompleted
              && sessionInfo.completionStatus === 'IN_PROGRESS'
              && correctionWindowOpen
              && userCanActivateMaterials && (
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleActivateMaterials}
                  disabled={activatingMaterials}
                >
                  {activatingMaterials ? 'Mengaktifkan Material...' : 'Aktifkan Material & Stok'}
                </button>
                <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Sistem akan memvalidasi stok Infus Set + Pelengkap dan membuat komponen wajib sebagai draft. Stok dipotong saat sesi diselesaikan.
                </p>
              </div>
            )}
          </div>
        )}

        {activeStep === 5 && !skipsInventory && (
          <Step6Materials 
            sessionId={sessionId}
            branchId={sessionInfo.branchId || ''}
            materials={session.materials || []}
            isLocked={!canAccessStep(5) || !canEditStepNow(5)}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 6 && (
          <Step7Photo 
            sessionId={sessionId}
            photo={session.photo}
            isLocked={!canAccessStep(6) || !canEditStepNow(6)}
            onComplete={handleStepComplete}
          />
        )}
        
        {activeStep === 7 && (
          <Step8VitalAfter 
            sessionId={sessionId}
            vitalSigns={session.vitalSigns}
            isLocked={!canAccessStep(7) || !canEditStepNow(7)}
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
            isLocked={!canAccessStep(8) || !canEditStepNow(8)}
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
            isLocked={!canAccessStep(9) || !canEditStepNow(9)}
            onComplete={handleStepComplete}
          />
        )}
        </SessionWorkflowDraftProvider>
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
            {sessionInfo.cancellationReason || 'Posting revenue dan quantity persediaan telah dibalik.'}
          </p>
        </div>
      )}

      {!isCompletionCancelled
        && steps.step3_vitalBefore
        && steps.step4_infusion
        && steps.step7_vitalAfter
        && (
        <WhatsAppReportCard
          sessionId={sessionId}
          canManageConsent={['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN'].includes(user?.role || '')}
        />
      )}

      {showCompletionReview && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} style={{
          position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0, 0, 0, 0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div className={`card ${styles.modalCard}`} style={{ width: '100%', maxWidth: '620px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Review sebelum menyelesaikan sesi</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {skipsInventory
                    ? 'Pastikan tindakan, tanda vital, dan evaluasi sudah sesuai. Sesi lama ini tidak memproses inventory.'
                    : 'Pastikan tindakan, tanda vital, material, dan evaluasi sudah sesuai kondisi aktual.'}
                </p>
              </div>
              <button type="button" onClick={() => !completing && setShowCompletionReview(false)} disabled={completing} aria-label="Tutup review" style={{ border: 0, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {[
                ['Member', completionSummary.member],
                ['Sesi', completionSummary.sessionCode],
                ['Therapy plan', completionSummary.therapyPlan],
                ['Vital sebelum/sesudah', `${completionSummary.vitalBefore}/${completionSummary.vitalAfter} catatan`],
                ['Material', `${completionSummary.materialLines} baris · ${completionSummary.materialQuantity} unit`],
                ['Deviasi material', `${completionSummary.deviations} baris`],
                ['Sumber stok', skipsInventory ? 'Tidak ada (sesi lama)' : inventorySource === 'TEAM' ? 'Stok Tim' : inventorySource === 'BRANCH' ? 'Stok Cabang' : 'Belum dipilih'],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: '12px', border: '1px solid var(--surface-border)', borderRadius: '10px', background: 'var(--surface-input)' }}>
                  <small style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</small>
                  <strong style={{ fontSize: '13px' }}>{value}</strong>
                </div>
              ))}
            </div>

            {missingRequiredSteps.length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                Belum lengkap: {missingRequiredSteps.map((item) => item.label).join(', ')}.
              </div>
            )}
            {completionError && (
              <div role="alert" style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                <strong>Completion belum berhasil.</strong><br />{completionError}
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              {workflowSaveState === 'CONFLICT' && (
                <button type="button" className="btn btn-secondary" onClick={() => void loadSessionDetail()} disabled={completing}>
                  Muat ulang data terbaru
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setShowCompletionReview(false)} disabled={completing}>Kembali periksa</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (completionError) metricsRef.current.retryCount += 1;
                  void handleCompleteSession();
                }}
                disabled={completing || missingRequiredSteps.length > 0 || (!skipsInventory && !inventorySource) || workflowSaveState === 'CONFLICT'}
              >
                {completing
                  ? skipsInventory ? 'Memproses sesi & finance...' : 'Memproses stok & finance...'
                  : completionError ? 'Coba completion lagi' : 'Konfirmasi & selesaikan'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showCancellationModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(0, 0, 0, 0.68)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div className={`card ${styles.modalCard}`} style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Batalkan Completion</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                  Revenue dan konsumsi quantity inventory akan dibalik dalam satu transaksi.
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
        <div className={styles.modalOverlay} style={{
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
            className={`card ${styles.modalCard}`}
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
                  {sessionInfo.isCompleted
                    ? 'Ubah seluruh data sesi melalui reversal terkontrol, lalu selesaikan kembali sesi.'
                    : 'Ubah jadwal, pelaksanaan, paket, dan tim yang menangani sesi ini.'}
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

            {sessionInfo.isCompleted && !boosterEditError && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.10)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                color: '#60a5fa',
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                Sesi sudah diposting. Saat disimpan, sistem akan membalik stok, voucher, dan jurnal lama,
                membuka sesi menjadi pending, lalu menerapkan perubahan. Sesi wajib diselesaikan kembali
                untuk membuat posting baru.
              </div>
            )}

            <div className={styles.formGrid} style={{
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
                  disabled={sessionEditFieldDisabled}
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
                  disabled={sessionEditFieldDisabled}
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
                  disabled={sessionEditFieldDisabled}
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
                  disabled={sessionEditFieldDisabled}
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
                  MSO
                </label>
                <select
                  value={sessionEditAdminLayananId}
                  onChange={(event) => setSessionEditAdminLayananId(event.target.value)}
                  disabled={sessionEditFieldDisabled}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Pilih MSO</option>
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
                  disabled={sessionEditFieldDisabled}
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
                  disabled={sessionEditFieldDisabled}
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
              cursor: sessionEditFieldDisabled ? 'not-allowed' : 'pointer',
            }}>
              <input
                type="checkbox"
                checked={sessionEditShiftFollowing}
                onChange={(event) => setSessionEditShiftFollowing(event.target.checked)}
                disabled={sessionEditFieldDisabled}
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

            <div className={styles.formGrid} style={{
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
                        disabled={sessionEditFieldDisabled}
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
                        disabled={sessionEditFieldDisabled}
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
                cursor: sessionEditFieldDisabled || (boosterPackageChangeLocked && !sessionInfo.isCompleted) ? 'not-allowed' : 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={boosterEditUseBooster}
                  onChange={(event) => {
                    setBoosterEditUseBooster(event.target.checked);
                    if (!event.target.checked) setBoosterEditPackageId('');
                  }}
                  disabled={sessionEditFieldDisabled || (boosterPackageChangeLocked && !sessionInfo.isCompleted)}
                />
                Gunakan paket booster untuk sesi ini
              </label>

              {boosterPackageChangeLocked && !sessionInfo.isCompleted && (
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
                    disabled={sessionEditFieldDisabled || (boosterPackageChangeLocked && !sessionInfo.isCompleted)}
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

            {sessionInfo.isCompleted && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                background: 'rgba(245, 158, 11, 0.08)',
              }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Alasan koreksi sesi posted
                </label>
                <textarea
                  value={postedEditReason}
                  onChange={(event) => setPostedEditReason(event.target.value)}
                  maxLength={1000}
                  disabled={savingBoosterPackage}
                  placeholder="Contoh: assignment nakes dan paket pada sesi salah input"
                  style={{
                    width: '100%',
                    minHeight: '82px',
                    resize: 'vertical',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)',
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '12px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={postedEditConfirmed}
                    onChange={(event) => setPostedEditConfirmed(event.target.checked)}
                    disabled={savingBoosterPackage}
                    style={{ marginTop: '2px' }}
                  />
                  Saya memahami posting lama akan direversal dan sesi harus diselesaikan kembali.
                </label>
              </div>
            )}

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
                {savingBoosterPackage
                  ? 'Menyimpan...'
                  : sessionInfo.isCompleted
                    ? 'Reversal & Simpan Perubahan'
                    : 'Simpan'}
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
      {!sessionInfo.isCompleted && allRequiredStepsComplete && userCanFinalize && (
        <div className={styles.completionAction} style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px',
          borderRadius: '18px',
          background: 'var(--surface-card)',
          border: '1px solid var(--surface-border)',
          boxShadow: '0 10px 32px rgba(0, 0, 0, 0.24)',
        }}>
          {skipsInventory ? (
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>
              Sesi lama · tanpa penggunaan stok
            </div>
          ) : (
            <>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Ambil bahan dari
              </label>
              <select
            value={inventorySource}
            onChange={(event) => setInventorySource(event.target.value as '' | 'BRANCH' | 'TEAM')}
            disabled={completing}
            aria-label="Sumber stok penyelesaian sesi"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid var(--surface-border)',
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              fontWeight: 700,
            }}
          >
            <option value="">Pilih sumber stok</option>
            <option value="TEAM">Stok Tim</option>
            <option value="BRANCH">Stok Cabang</option>
              </select>
            </>
          )}
          <button
            onClick={() => {
              setCompletionError(null);
              setShowCompletionReview(true);
            }}
            disabled={completing || (!skipsInventory && !inventorySource)}
            style={{
              padding: '18px 32px',
              fontSize: '16px',
              fontWeight: '700',
              color: 'white',
              background: completing || (!skipsInventory && !inventorySource)
                ? 'rgba(34, 197, 94, 0.5)'
                : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              borderRadius: '16px',
              cursor: completing || (!skipsInventory && !inventorySource) ? 'not-allowed' : 'pointer',
              boxShadow: completing || (!skipsInventory && !inventorySource)
                ? 'none'
                : '0 8px 32px rgba(34, 197, 94, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'floatingButtonPulse 2s infinite',
            }}
            onMouseEnter={(e) => {
              if (!completing && (skipsInventory || inventorySource)) {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(34, 197, 94, 0.6), 0 6px 16px rgba(0, 0, 0, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!completing && (skipsInventory || inventorySource)) {
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
      className={styles.stepIndicator}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-current={active ? 'step' : undefined}
      aria-disabled={locked}
      aria-label={`Step ${number}: ${title}${completed ? ', selesai' : locked ? ', terkunci' : active ? ', sedang dibuka' : ''}`}
      onClick={locked ? undefined : onClick}
      onKeyDown={(event) => {
        if (!locked && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick?.();
        }
      }}
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
