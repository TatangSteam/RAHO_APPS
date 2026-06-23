'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { TherapyPlan as SessionTherapyPlan } from '@/types/session';
import { therapyPlanApi, type TherapyPlan } from '@/lib/therapyPlanApi';
import { useAuthStore } from '@/stores/authStore';
import TherapyPlanListTable from '@/components/therapy-plan/TherapyPlanListTable';
import EditTherapyPlanSetModal from '@/components/therapy-plan/EditTherapyPlanSetModal';
import styles from './Step2TherapyPlan.module.css';

interface Step2TherapyPlanProps {
  sessionId: string;
  memberId: string;
  therapyPlan: SessionTherapyPlan | null;
  isLocked: boolean;
  onComplete: () => void;
}

const SESSION_THERAPY_PLAN_EDITORS = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'DOCTOR'];

function toTablePlan(plan: SessionTherapyPlan, sessionId: string): TherapyPlan {
  return {
    ...plan,
    keterangan: plan.keterangan || '',
    ifa250: plan.ifa250 ?? undefined,
    ifa500: plan.ifa500 ?? undefined,
    hho: plan.hho ?? undefined,
    h2: plan.h2 ?? undefined,
    no: plan.no ?? undefined,
    gaso: plan.gaso ?? undefined,
    o2: plan.o2 ?? undefined,
    o3: plan.o3 ?? undefined,
    edta: plan.edta ?? undefined,
    mb: plan.mb ?? undefined,
    h2s: plan.h2s ?? undefined,
    kcl: plan.kcl ?? undefined,
    jmlNb: plan.jmlNb ?? undefined,
    isUsed: true,
    usedInSession: {
      id: sessionId,
      sessionCode: '',
      treatmentDate: plan.createdAt,
      infusKe: plan.planNumber || 0,
      branchName: '',
      branchCode: '',
      totalSessionsCount: plan.planNumber || 0,
      branchSessionsCount: plan.planNumber || 0,
    },
  };
}

export default function Step2TherapyPlan({
  sessionId,
  memberId,
  therapyPlan,
  isLocked,
  onComplete,
}: Step2TherapyPlanProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [therapyPlanSet, setTherapyPlanSet] = useState<TherapyPlan[]>([]);
  const [loadingSet, setLoadingSet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const canEdit = Boolean(
    user?.role && SESSION_THERAPY_PLAN_EDITORS.includes(user.role)
  );

  const loadTherapyPlanSet = useCallback(async () => {
    if (!therapyPlan || !memberId) {
      setTherapyPlanSet([]);
      return;
    }

    try {
      setLoadingSet(true);
      const sameSetPlans = await therapyPlanApi.getSessionTherapyPlanSet(sessionId);
      setTherapyPlanSet(
        sameSetPlans.sort(
          (first, second) =>
            (first.planNumber || 0) - (second.planNumber || 0)
        )
      );
    } catch (error) {
      console.error('Error loading therapy plan set:', error);
      setTherapyPlanSet([toTablePlan(therapyPlan, sessionId)]);
    } finally {
      setLoadingSet(false);
    }
  }, [memberId, sessionId, therapyPlan]);

  useEffect(() => {
    void loadTherapyPlanSet();
  }, [loadTherapyPlanSet]);

  const plansForTable = useMemo(
    () =>
      therapyPlanSet.length > 0
        ? therapyPlanSet
        : therapyPlan
          ? [toTablePlan(therapyPlan, sessionId)]
          : [],
    [sessionId, therapyPlan, therapyPlanSet]
  );

  const handleEditSuccess = async () => {
    setShowEditModal(false);
    await onComplete();
  };

  if (isLocked) {
    return (
      <div className={`${styles.container} ${styles.locked}`}>
        <div className={styles.header}>
          <div className={`${styles.stepNumber} ${styles.locked}`}>2</div>
          <div className={styles.headerContent}>
            <h3 className={styles.title}>Step 2: Acuan Therapy Plan</h3>
            <p className={styles.subtitle}>Diagnosa harus diisi terlebih dahulu</p>
          </div>
        </div>
      </div>
    );
  }

  if (!therapyPlan) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={`${styles.stepNumber} ${styles.active}`}>2</div>
          <div className={styles.headerContent}>
            <h3 className={styles.title}>Step 2: Acuan Therapy Plan</h3>
            <p className={styles.subtitle}>Therapy plan harus dipilih dari set bulk saat sesi dibuat</p>
          </div>
        </div>

        <div className={styles.errorAlert}>
          <span className={styles.errorIcon}>!</span>
          <span>
            Sesi ini belum memiliki acuan therapy plan. Buat atau pilih therapy plan dari set bulk member sebelum sesi berjalan.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${styles.completed}`}>
      <div
        className={styles.header}
        style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className={`${styles.stepNumber} ${styles.completed}`}>OK</div>
          <div className={styles.headerContent}>
            <h3 className={styles.title}>Step 2: Acuan Therapy Plan</h3>
            <p className={styles.subtitle}>
              {therapyPlan.setName || `Set v${therapyPlan.setVersion || 1}`} · Terapi #{therapyPlan.planNumber || '-'}
            </p>
          </div>
        </div>

        {canEdit && therapyPlan.therapyPlanSetId && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowEditModal(true)}
            disabled={loadingSet || plansForTable.length === 0}
          >
            <Pencil size={15} />
            Edit Therapy Plan
          </button>
        )}
      </div>

      <div className={styles.completedContent}>
        {loadingSet ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Memuat therapy plan...
            </p>
          </div>
        ) : (
          <TherapyPlanListTable
            plans={plansForTable}
            memberId={memberId}
            onOpenSession={(targetSessionId) => {
              if (targetSessionId !== sessionId) {
                router.push(`/sessions/${targetSessionId}`);
              }
            }}
            hideInfusKe
            highlightPlanId={therapyPlan.id}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onComplete}>
            Lanjut
          </button>
        </div>
      </div>

      {canEdit && therapyPlan.therapyPlanSetId && (
        <EditTherapyPlanSetModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          memberId={memberId}
          therapyPlans={plansForTable}
          editableSessionId={sessionId}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
