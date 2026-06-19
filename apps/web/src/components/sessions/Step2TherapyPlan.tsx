'use client';

import { useState, useEffect } from 'react';
import type { TherapyPlan } from '@/types/session';
import TherapyPlanDoseTable from '@/components/therapy-plan/TherapyPlanDoseTable';
import TherapyPlanListTable from '@/components/therapy-plan/TherapyPlanListTable';
import { therapyPlanApi } from '@/lib/therapyPlanApi';
import type { TherapyPlan as TherapyPlanApiType } from '@/lib/therapyPlanApi';
import styles from './Step2TherapyPlan.module.css';

interface Step2TherapyPlanProps {
  sessionId: string;
  memberId: string;
  therapyPlan: TherapyPlan | null;
  isLocked: boolean;
  onComplete: () => void;
}

export default function Step2TherapyPlan({
  memberId,
  therapyPlan,
  isLocked,
  onComplete,
}: Step2TherapyPlanProps) {
  const [therapyPlanSet, setTherapyPlanSet] = useState<TherapyPlanApiType[]>([]);
  const [loadingSet, setLoadingSet] = useState(false);

  useEffect(() => {
    if (therapyPlan?.therapyPlanSetId && memberId) {
      loadTherapyPlanSet();
    }
  }, [therapyPlan?.therapyPlanSetId, memberId]);

  const loadTherapyPlanSet = async () => {
    if (!therapyPlan?.therapyPlanSetId || !memberId) return;

    try {
      setLoadingSet(true);
      const allPlans = await therapyPlanApi.getMemberTherapyPlans(memberId);
      // Filter to only plans from the same set
      const samSetPlans = allPlans.filter(
        (plan) => plan.therapyPlanSetId === therapyPlan.therapyPlanSetId
      );
      setTherapyPlanSet(samSetPlans);
    } catch (error) {
      console.error('Error loading therapy plan set:', error);
      setTherapyPlanSet([]);
    } finally {
      setLoadingSet(false);
    }
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
      <div className={styles.header}>
        <div className={`${styles.stepNumber} ${styles.completed}`}>OK</div>
        <div className={styles.headerContent}>
          <h3 className={styles.title}>Step 2: Acuan Therapy Plan</h3>
          <p className={styles.subtitle}>Terapi #{therapyPlan.planNumber || '-'}</p>
        </div>
      </div>

      <div className={styles.completedContent}>
        {/* Show therapy plan set table if available */}
        {therapyPlanSet.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              marginBottom: '12px',
              padding: '12px 16px',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.22)',
              borderRadius: '8px',
            }}>
              <h4 style={{ 
                fontSize: '14px', 
                fontWeight: '700',
                color: '#60a5fa',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: '18px' }}>📋</span>
                <span>Therapy Plan Set: {therapyPlan.setName || `Set v${therapyPlan.setVersion || 1}`}</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                }}>
                  {therapyPlanSet.length} Terapi dalam Set
                </span>
              </h4>
            </div>
            
            {loadingSet ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }}></div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Memuat therapy plan set...</p>
              </div>
            ) : (
              <TherapyPlanListTable
                plans={therapyPlanSet}
                memberId={memberId}
                onOpenSession={() => {}}
                hideInfusKe={true}
                hideStatus={true}
                hideAksi={true}
              />
            )}
          </div>
        )}

        {/* Current plan detail */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.22)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <span style={{ 
              fontSize: '13px', 
              fontWeight: '700',
              color: '#22c55e',
            }}>
              Terapi Saat Ini (Terapi #{therapyPlan.planNumber || '-'})
            </span>
          </div>

          <TherapyPlanDoseTable
            plan={therapyPlan}
            showSourceColumn={false}
            showNoteColumn={false}
            includeDefaultIfaSubstances={false}
          />
        </div>

        {therapyPlan.keterangan && (
          <div className={styles.keteranganSection}>
            <p className={styles.keteranganLabel}>Keterangan:</p>
            <p className={styles.keteranganValue}>{therapyPlan.keterangan}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onComplete}>
            Lanjut
          </button>
        </div>
      </div>
    </div>
  );
}
