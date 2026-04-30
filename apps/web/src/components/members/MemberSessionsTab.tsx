'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import CreateSessionModal from '@/components/sessions/CreateSessionModal';
import type { SessionDetail } from '@/types/session';

interface MemberSessionsTabProps {
  memberId: string;
  memberNo: string;
  memberName: string;
}

export default function MemberSessionsTab({ memberId, memberNo, memberName }: MemberSessionsTabProps) {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [memberId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await sessionApi.getMemberSessions(memberId);
      setSessions(data || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionCreated = (sessionId: string) => {
    setIsCreateModalOpen(false);
    router.push(`/sessions/${sessionId}`);
  };

  const getStepProgress = (session: SessionDetail) => {
    let completedSteps = 0;
    // Step 1: Diagnosis
    if (session.diagnosis) completedSteps++;
    // Step 2: Therapy Plan
    if (session.therapyPlan) completedSteps++;
    // Step 3: Vital Before
    const vitalSignsBefore = session.vitalSigns?.filter(v => v.waktuCatat === 'SEBELUM') || [];
    if (vitalSignsBefore && vitalSignsBefore.length > 0) completedSteps++;
    // Step 4: Booster (conditional - only if booster package exists)
    // Don't count this as it's conditional
    // Step 5: Infusion
    if (session.infusion) completedSteps++;
    // Step 6: Materials (REQUIRED)
    if (session.materials && session.materials.length > 0) completedSteps++;
    // Step 7: Photo (OPTIONAL - don't count)
    // Step 8: Vital After
    const vitalSignsAfter = session.vitalSigns?.filter(v => v.waktuCatat === 'SESUDAH') || [];
    if (vitalSignsAfter && vitalSignsAfter.length > 0) completedSteps++;
    // Step 9: Evaluation
    if (session.evaluation) completedSteps++;
    return completedSteps;
  };

  // Check if there's an incomplete session
  // Filter out invalid sessions (sessions without session data)
  const validSessions = sessions.filter(s => s.session != null);

  const hasIncompleteSession = validSessions.some(session => {
    const progress = getStepProgress(session);
    return progress < 7; // 7 required steps (excluding photo which is optional)
  });

  // Separate sessions into incomplete and complete
  const incompleteSessions = validSessions.filter(session => getStepProgress(session) < 7);
  const completeSessions = validSessions.filter(session => getStepProgress(session) === 7);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600' }}>🩺 Sesi Terapi</h3>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
          disabled={hasIncompleteSession}
          title={hasIncompleteSession ? 'Selesaikan sesi yang sedang berjalan terlebih dahulu' : ''}
        >
          ➕ Buat Sesi Baru
        </button>
      </div>

      {validSessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>🩺</p>
          <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            Belum Ada Sesi Terapi
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Klik tombol "Buat Sesi Baru" untuk memulai sesi terapi pertama
          </p>
        </div>
      ) : (
        <>
          {hasIncompleteSession && (
            <div style={{
              padding: '16px',
              background: 'rgba(251,191,36,0.15)',
              border: '2px solid rgba(251,191,36,0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#fbbf24', marginBottom: '4px' }}>
                    Ada Sesi yang Belum Lengkap
                  </p>
                  <p style={{ fontSize: '13px', color: '#fcd34d' }}>
                    Selesaikan sesi yang sedang berjalan terlebih dahulu sebelum membuat sesi baru.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Incomplete Sessions */}
          {incompleteSessions.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h4 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#fbbf24',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                ⏳ Sesi Sedang Berjalan ({incompleteSessions.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {incompleteSessions.map((sessionDetail) => {
                  const progress = getStepProgress(sessionDetail);
                  const progressPercent = (progress / 7) * 100; // 7 required steps

                  return (
                    <div
                      key={sessionDetail.session.sessionId}
                      className="card"
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        border: '2px solid rgba(251,191,36,0.3)',
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.05), rgba(245,158,11,0.05))'
                      }}
                      onClick={() => router.push(`/sessions/${sessionDetail.session.sessionId}`)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '14px' }}>
                              {sessionDetail.session.sessionCode}
                            </p>
                            {sessionDetail.session.boosterPackage && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.2))',
                                color: '#fbbf24',
                                border: '1px solid rgba(251,191,36,0.3)',
                                width: 'fit-content'
                              }}>
                                <span>🚀</span>
                                <span>Booster {sessionDetail.session.boosterPackage.boosterType || ''}</span>
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {new Date(sessionDetail.session.treatmentDate).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <span
                          className={`badge ${
                            sessionDetail.session.pelaksanaan === 'ON_SITE' ? 'badge-blue' : 'badge-purple'
                          }`}
                        >
                          {sessionDetail.session.pelaksanaan === 'ON_SITE' ? '🏥 On Site' : '🏠 Home Care'}
                        </span>
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Progress (Required Steps)</span>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#fbbf24' }}>
                            {progress}/7
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(148,163,184,0.2)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${progressPercent}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                              transition: 'width var(--transition-normal)',
                            }}
                          ></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                        <span className={`badge ${sessionDetail.diagnosis ? 'badge-green' : 'badge-gray'}`}>
                          {sessionDetail.diagnosis ? '✅' : '⏳'} Diagnosis
                        </span>
                        <span className={`badge ${sessionDetail.therapyPlan ? 'badge-green' : 'badge-gray'}`}>
                          {sessionDetail.therapyPlan ? '✅' : '⏳'} Therapy Plan
                        </span>
                        <span className={`badge ${(sessionDetail.vitalSigns?.filter(v => v.waktuCatat === 'SEBELUM') || []).length > 0 ? 'badge-green' : 'badge-gray'}`}>
                          {(sessionDetail.vitalSigns?.filter(v => v.waktuCatat === 'SEBELUM') || []).length > 0 ? '✅' : '⏳'} Vital Before
                        </span>
                        <span className={`badge ${sessionDetail.infusion ? 'badge-green' : 'badge-gray'}`}>
                          {sessionDetail.infusion ? '✅' : '⏳'} Infusion
                        </span>
                        <span className={`badge ${sessionDetail.materials && sessionDetail.materials.length > 0 ? 'badge-green' : 'badge-gray'}`}>
                          {sessionDetail.materials && sessionDetail.materials.length > 0 ? '✅' : '⏳'} Materials
                        </span>
                        <span className={`badge ${(sessionDetail.vitalSigns?.filter(v => v.waktuCatat === 'SESUDAH') || []).length > 0 ? 'badge-green' : 'badge-gray'}`}>
                          {(sessionDetail.vitalSigns?.filter(v => v.waktuCatat === 'SESUDAH') || []).length > 0 ? '✅' : '⏳'} Vital After
                        </span>
                        <span className={`badge ${sessionDetail.evaluation ? 'badge-green' : 'badge-gray'}`}>
                          {sessionDetail.evaluation ? '✅' : '⏳'} Evaluation
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Complete Sessions */}
          {completeSessions.length > 0 && (
            <div>
              <h4 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#22c55e',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                ✅ Sesi Selesai ({completeSessions.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {completeSessions.map((sessionDetail) => {
                  const progress = getStepProgress(sessionDetail);
                  const progressPercent = (progress / 7) * 100; // 7 required steps

                  return (
                    <div
                      key={sessionDetail.session.sessionId}
                      className="card"
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                      onClick={() => router.push(`/sessions/${sessionDetail.session.sessionId}`)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '14px' }}>
                              {sessionDetail.session.sessionCode}
                            </p>
                            {sessionDetail.session.boosterPackage && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.2))',
                                color: '#fbbf24',
                                border: '1px solid rgba(251,191,36,0.3)',
                                width: 'fit-content'
                              }}>
                                <span>🚀</span>
                                <span>Booster {sessionDetail.session.boosterPackage.boosterType || ''}</span>
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {new Date(sessionDetail.session.treatmentDate).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <span
                          className={`badge ${
                            sessionDetail.session.pelaksanaan === 'ON_SITE' ? 'badge-blue' : 'badge-purple'
                          }`}
                        >
                          {sessionDetail.session.pelaksanaan === 'ON_SITE' ? '🏥 On Site' : '🏠 Home Care'}
                        </span>
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Progress (Required Steps)</span>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#22c55e' }}>
                            {progress}/7 ✓
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(148,163,184,0.2)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${progressPercent}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                              transition: 'width var(--transition-normal)',
                            }}
                          ></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                        <span className="badge badge-green">✅ Diagnosis</span>
                        <span className="badge badge-green">✅ Therapy Plan</span>
                        <span className="badge badge-green">✅ Vital Before</span>
                        <span className="badge badge-green">✅ Infusion</span>
                        <span className="badge badge-green">✅ Materials</span>
                        <span className="badge badge-green">✅ Vital After</span>
                        <span className="badge badge-green">✅ Evaluation</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleSessionCreated}
        preselectedMemberId={memberId}
      />
    </div>
  );
}
