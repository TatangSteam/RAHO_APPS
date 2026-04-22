'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import CreateSessionModal from '@/components/sessions/CreateSessionModal';
import type { SessionDetail } from '@/types/session';

export default function SessionsPage() {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'incomplete'>('all');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await sessionApi.getAllSessions();
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
    // Step 5: Infusion
    if (session.infusion) completedSteps++;
    // Step 6: Materials (REQUIRED)
    if (session.materials && session.materials.length > 0) completedSteps++;
    // Step 8: Vital After
    const vitalSignsAfter = session.vitalSigns?.filter(v => v.waktuCatat === 'SESUDAH') || [];
    if (vitalSignsAfter && vitalSignsAfter.length > 0) completedSteps++;
    // Step 9: Evaluation
    if (session.evaluation) completedSteps++;
    return completedSteps;
  };

  // Filter sessions
  const filteredSessions = sessions.filter((sessionDetail) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        sessionDetail.session.sessionCode.toLowerCase().includes(query) ||
        sessionDetail.session.member.fullName.toLowerCase().includes(query) ||
        sessionDetail.session.member.memberNo.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Date filter
    if (dateFilter) {
      const sessionDate = new Date(sessionDetail.session.treatmentDate).toISOString().split('T')[0];
      if (sessionDate !== dateFilter) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const progress = getStepProgress(sessionDetail);
      if (statusFilter === 'completed' && progress < 7) return false;
      if (statusFilter === 'incomplete' && progress === 7) return false;
    }

    return true;
  });

  return (
    <div className="p-8 lg:px-16">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]">
            Sesi Terapi
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Kelola sesi terapi infus member
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
        >
          + Buat Sesi Baru
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="form-group">
            <label className="form-label">Cari</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kode sesi, nama member, atau member no..."
              className="form-input"
            />
          </div>

          {/* Date Filter */}
          <div className="form-group">
            <label className="form-label">Tanggal</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Status Filter */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="form-input"
            >
              <option value="all">Semua Status</option>
              <option value="completed">Selesai (7/7)</option>
              <option value="incomplete">Belum Selesai</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(searchQuery || dateFilter || statusFilter !== 'all') && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setSearchQuery('');
                setDateFilter('');
                setStatusFilter('all');
              }}
              className="btn btn-secondary btn-sm"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="spinner w-8 h-8 mx-auto mb-4"></div>
            <p className="text-[var(--text-secondary)]">Memuat data sesi...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-6xl mb-4">🩺</div>
            <p className="text-base font-medium text-[var(--text-secondary)] mb-2">
              {sessions.length === 0 ? 'Belum ada sesi terapi' : 'Tidak ada sesi yang sesuai filter'}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {sessions.length === 0 
                ? 'Klik tombol "Buat Sesi Baru" untuk memulai'
                : 'Coba ubah filter pencarian Anda'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface-bg)]/60 border-b border-[var(--surface-border)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Kode Sesi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Pelaksanaan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {filteredSessions.map((sessionDetail) => {
                  const progress = getStepProgress(sessionDetail);
                  const progressPercent = (progress / 7) * 100;

                  return (
                    <tr key={sessionDetail.session.sessionId} className="hover:bg-gray-500/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-semibold">
                          {sessionDetail.session.sessionCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium mb-0.5">
                            {sessionDetail.session.member.fullName}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] font-mono">
                            {sessionDetail.session.member.memberNo}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                        {new Date(sessionDetail.session.treatmentDate).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge ${
                          sessionDetail.session.pelaksanaan === 'ON_SITE' ? 'badge-blue' : 'badge-purple'
                        }`}>
                          {sessionDetail.session.pelaksanaan === 'ON_SITE' ? '🏥 On Site' : '🏠 Home Care'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-[100px] h-1.5 bg-gray-500/20 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                progressPercent === 100 
                                  ? 'bg-gradient-to-r from-green-500 to-green-600' 
                                  : 'bg-gradient-to-r from-blue-500 to-blue-600'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-secondary)] min-w-[32px]">
                            {progress}/7
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => router.push(`/sessions/${sessionDetail.session.sessionId}`)}
                          className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
                        >
                          Lihat Detail →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleSessionCreated}
      />
    </div>
  );
}
