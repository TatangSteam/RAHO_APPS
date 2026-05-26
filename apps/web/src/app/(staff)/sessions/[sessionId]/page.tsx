'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import { showToast } from '@/lib/toast';
import type { SessionDetail } from '@/types/session';
import Step1Diagnosis from '@/components/sessions/Step1Diagnosis';
import Step2TherapyPlan from '@/components/sessions/Step2TherapyPlan';
import Step3VitalBefore from '@/components/sessions/Step3VitalBefore';
import Step5Infusion from '@/components/sessions/Step5Infusion';
import Step6Materials from '@/components/sessions/Step6Materials';
import Step7Photo from '@/components/sessions/Step7Photo';
import Step8VitalAfter from '@/components/sessions/Step8VitalAfter';
import Step9Evaluation from '@/components/sessions/Step9Evaluation';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [completing, setCompleting] = useState(false);
  const [showStaffInfo, setShowStaffInfo] = useState(false);

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
        else if (!data.steps.step8_evaluation) setActiveStep(8);
      }
    } catch (error: any) {
      console.error('Error loading session detail:', error);
      const errorMessage = error.response?.data?.error?.message || 'Gagal memuat detail sesi';
      showToast.error(errorMessage);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = () => {
    loadSessionDetail();
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
      console.error('Error completing session:', error);
      const errorMessage = error.response?.data?.error?.message || 'Gagal menyelesaikan sesi';
      showToast.error(errorMessage);
    } finally {
      setCompleting(false);
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
  
  // Check if step can be accessed
  const canAccessStep = (step: number): boolean => {
    if (step === 1) return true; // Diagnosis always accessible
    if (step === 2) return steps.step1_diagnosis; // Therapy Plan needs diagnosis
    if (step === 3) return steps.step2_therapyPlan; // Vital Before needs therapy plan
    if (step === 4) return steps.step2_therapyPlan && steps.step3_vitalBefore; // Infusion needs therapy plan and vital before
    if (step === 5) return steps.step4_infusion; // Materials needs infusion
    if (step === 6) return steps.step5_materials; // Photo needs materials (optional step)
    if (step === 7) return steps.step5_materials; // Vital After needs materials (photo is optional)
    if (step === 8) return steps.step7_vitalAfter; // Evaluation needs vital after
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
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
          ← Kembali
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
              {sessionInfo.sessionCode}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {sessionInfo.member.fullName} ({sessionInfo.member.memberNo}) • 
              Infus ke-{sessionInfo.infusKe} • 
              {new Date(sessionInfo.treatmentDate).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          
          {sessionInfo.isCompleted && (
            <span className="badge badge-success" style={{ fontSize: '14px', padding: '8px 16px' }}>
              ✓ Sesi Selesai
            </span>
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
            title="Evaluasi Dokter" 
            completed={steps.step8_evaluation} 
            active={activeStep === 8}
            onClick={() => canAccessStep(8) && setActiveStep(8)}
            locked={!canAccessStep(8)}
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
            therapyPlan={session.therapyPlan}
            infusion={session.infusion}
            isLocked={!canAccessStep(4)}
            onComplete={handleStepComplete}
            onNext={() => setActiveStep(5)}
          />
        )}
        
        {activeStep === 5 && (
          <Step6Materials 
            sessionId={sessionId}
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
          <Step9Evaluation 
            sessionId={sessionId}
            evaluation={session.evaluation}
            isLocked={!canAccessStep(8)}
            onComplete={handleStepComplete}
          />
        )}
      </div>

      {/* Session Completed Banner */}
      {sessionInfo.isCompleted && (
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
          <button
            onClick={() => router.push(`/members/${session.session.member.memberId}`)}
            className="btn btn-secondary"
            style={{ padding: '12px 24px' }}
          >
            ← Kembali ke Profil Member
          </button>
        </div>
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
