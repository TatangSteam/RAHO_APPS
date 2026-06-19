'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { therapyPlanApi, type TherapyPlan } from '@/lib/therapyPlanApi';
import { showToast } from '@/lib/toast';
import TherapyPlanListTable from '@/components/therapy-plan/TherapyPlanListTable';
import { hasAdditionalIfaSubstances } from '@/lib/therapyPlanSubstances';
import BulkTherapyPlanModal from './BulkTherapyPlanModal';
import EditTherapyPlanSetModal from '../therapy-plan/EditTherapyPlanSetModal';
import { useAuthStore } from '@/stores/authStore';

interface MemberTherapyPlansTabProps {
  memberId: string;
}

type TherapyPlanStatusFilter = 'all' | 'available' | 'used' | 'superseded';

interface TherapyPlanFilters {
  search: string;
  status: TherapyPlanStatusFilter;
  dateFrom: string;
  dateTo: string;
  ifaOnly: boolean;
  selectedSetId: string; // 'all' or specific setId
}

const createInitialFilters = (): TherapyPlanFilters => ({
  search: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  ifaOnly: false,
  selectedSetId: 'all',
});

function getPlanDate(plan: TherapyPlan): Date {
  return new Date(plan.usedInSession?.treatmentDate || plan.createdAt);
}

function getPlanDateKey(plan: TherapyPlan): string {
  const date = getPlanDate(plan);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isTherapyPlanEditHistory(plan: TherapyPlan): boolean {
  return Boolean(plan.supersededById || plan.supersededAt || plan.setStatus === 'SUPERSEDED');
}

function getPlanStatusKey(plan: TherapyPlan): Exclude<TherapyPlanStatusFilter, 'all'> {
  if (isTherapyPlanEditHistory(plan)) return 'superseded';
  return plan.isUsed ? 'used' : 'available';
}

function planMatchesFilters(plan: TherapyPlan, filters: TherapyPlanFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  const planDate = getPlanDateKey(plan);
  const substancesText = (plan.ifaSubstances || [])
    .map((substance) => `${substance.name} ${substance.keterangan || ''}`)
    .join(' ');

  const searchableText = [
    `terapi ${plan.planNumber || ''}`,
    plan.setName || '',
    plan.keterangan || '',
    plan.usedInSession?.sessionCode || '',
    substancesText,
  ]
    .join(' ')
    .toLowerCase();

  if (search && !searchableText.includes(search)) return false;
  if (filters.status !== 'all' && getPlanStatusKey(plan) !== filters.status) return false;
  if (filters.dateFrom && planDate < filters.dateFrom) return false;
  if (filters.dateTo && planDate > filters.dateTo) return false;
  if (filters.ifaOnly && !hasAdditionalIfaSubstances(plan.ifaSubstances, plan.ifaSubstanceTotalMl)) return false;
  
  // Filter by selected set
  if (filters.selectedSetId !== 'all' && getPlanSetKey(plan) !== filters.selectedSetId) return false;

  return true;
}

function getPlanSetKey(plan: TherapyPlan): string {
  return plan.therapyPlanSetId || `${plan.setName || 'legacy'}-${plan.setVersion || plan.version || 1}`;
}

function getSetSummary(plans: TherapyPlan[]) {
  return {
    totalSets: new Set(plans.map(getPlanSetKey)).size,
    totalRows: plans.length,
    available: plans.filter((plan) => getPlanStatusKey(plan) === 'available').length,
    used: plans.filter((plan) => getPlanStatusKey(plan) === 'used').length,
    history: plans.filter((plan) => getPlanStatusKey(plan) === 'superseded').length,
  };
}

export default function MemberTherapyPlansTab({ memberId }: MemberTherapyPlansTabProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [therapyPlans, setTherapyPlans] = useState<TherapyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditSetModal, setShowEditSetModal] = useState(false);
  const [selectedSetPlans, setSelectedSetPlans] = useState<TherapyPlan[]>([]);
  const [filters, setFilters] = useState<TherapyPlanFilters>(createInitialFilters);
  const [collapsedSets, setCollapsedSets] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTherapyPlans();
  }, [memberId]);

  const loadTherapyPlans = async () => {
    try {
      setLoading(true);
      const data = await therapyPlanApi.getMemberTherapyPlans(memberId);
      setTherapyPlans(data);
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat set therapy plan');
    } finally {
      setLoading(false);
    }
  };

  const filteredTherapyPlans = useMemo(() => {
    return therapyPlans.filter((plan) => planMatchesFilters(plan, filters));
  }, [therapyPlans, filters]);

  // Extract unique sets with metadata
  const uniqueSets = useMemo(() => {
    const setsMap = new Map<string, { id: string; name: string; version: number; count: number; firstPlan: TherapyPlan }>();
    
    therapyPlans.forEach((plan) => {
      const setKey = getPlanSetKey(plan);
      const existing = setsMap.get(setKey);
      
      if (existing) {
        existing.count++;
      } else {
        // Generate user-friendly name with priority:
        // 1. setName (user-defined)
        // 2. Extract short number from setCode + date
        // 3. Creation date only (for legacy data)
        let displayName: string;
        if (plan.setName && plan.setName.trim()) {
          displayName = plan.setName;
        } else if (plan.setCode) {
          // Extract the last number from setCode (e.g., "TPS-PST-MBR-PST-0008-003" -> "003")
          const match = plan.setCode.match(/(\d+)$/);
          const date = new Date(plan.createdAt);
          const dateStr = date.toLocaleDateString('id-ID', { 
            day: '2-digit', 
            month: 'short'
          });
          
          if (match) {
            const setNumber = parseInt(match[1], 10);
            displayName = `Set #${setNumber} - ${dateStr}`;
          } else {
            // If no number found, use date + time
            const timeStr = date.toLocaleTimeString('id-ID', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false
            });
            displayName = `Set ${dateStr} ${timeStr}`;
          }
        } else {
          // Fallback for legacy data without setCode
          const date = new Date(plan.createdAt);
          const dateStr = date.toLocaleDateString('id-ID', { 
            day: '2-digit', 
            month: 'short'
          });
          const timeStr = date.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
          });
          displayName = `Set ${dateStr} ${timeStr}`;
        }
        
        setsMap.set(setKey, {
          id: setKey,
          name: displayName,
          version: plan.setVersion || plan.version || 1,
          count: 1,
          firstPlan: plan,
        });
      }
    });
    
    return Array.from(setsMap.values()).sort((a, b) => {
      // Sort by creation date of first plan (newest first)
      const dateA = new Date(a.firstPlan.createdAt).getTime();
      const dateB = new Date(b.firstPlan.createdAt).getTime();
      return dateB - dateA;
    });
  }, [therapyPlans]);

  const summary = useMemo(() => getSetSummary(therapyPlans), [therapyPlans]);
  const hasActiveFilters = Boolean(
    filters.search.trim() ||
    filters.status !== 'all' ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.ifaOnly ||
    filters.selectedSetId !== 'all'
  );

  const handleBulkSuccess = () => {
    showToast.success('Set therapy plan berhasil dibuat');
    setShowBulkModal(false);
    loadTherapyPlans();
  };

  const handleEditSetClick = (setId: string) => {
    const setPlans = therapyPlans.filter((plan) => getPlanSetKey(plan) === setId);
    // Only allow editing ACTIVE sets (not superseded/history)
    const activePlans = setPlans.filter((plan) => plan.setStatus === 'ACTIVE' || !plan.setStatus);
    if (activePlans.length > 0) {
      setSelectedSetPlans(activePlans);
      setShowEditSetModal(true);
    } else {
      showToast.error('Tidak dapat mengedit set yang sudah superseded. Hanya set aktif yang bisa diedit.');
    }
  };

  const handleEditSetSuccess = () => {
    showToast.success('Set therapy plan berhasil diedit. Versi baru telah dibuat.');
    setShowEditSetModal(false);
    setSelectedSetPlans([]);
    loadTherapyPlans();
  };

  const toggleSetCollapse = (setId: string) => {
    setCollapsedSets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      return newSet;
    });
  };

  // Group filtered plans by set
  const groupedPlans = useMemo(() => {
    const grouped = new Map<string, TherapyPlan[]>();
    filteredTherapyPlans.forEach((plan) => {
      const setKey = getPlanSetKey(plan);
      if (!grouped.has(setKey)) {
        grouped.set(setKey, []);
      }
      grouped.get(setKey)!.push(plan);
    });
    return grouped;
  }, [filteredTherapyPlans]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-lg)' }}>
        <div className="spinner" style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Memuat set therapy plan...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Set Therapy Plan</h3>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Therapy plan dibuat bulk sebagai satu set dan hanya ditampilkan dalam tabel.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowBulkModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          Buat Set Bulk
        </button>
      </div>

      {showBulkModal && (
        <BulkTherapyPlanModal
          memberId={memberId}
          onClose={() => setShowBulkModal(false)}
          onSuccess={handleBulkSuccess}
        />
      )}

      {showEditSetModal && selectedSetPlans.length > 0 && (
        <EditTherapyPlanSetModal
          isOpen={showEditSetModal}
          onClose={() => {
            setShowEditSetModal(false);
            setSelectedSetPlans([]);
          }}
          memberId={memberId}
          therapyPlans={selectedSetPlans}
          onSuccess={handleEditSetSuccess}
        />
      )}

      {therapyPlans.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            {[
              { label: 'Total Set', value: summary.totalSets, color: '#60a5fa' },
              { label: 'Total Baris', value: summary.totalRows, color: '#38bdf8' },
              { label: 'Belum Digunakan', value: summary.available, color: '#f59e0b' },
              { label: 'Sudah Digunakan', value: summary.used, color: '#22c55e' },
              { label: 'History Edit', value: summary.history, color: '#94a3b8' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148,163,184,0.22)',
                  background: 'rgba(148,163,184,0.06)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '24px', color: item.color, fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginBottom: '16px',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid rgba(148,163,184,0.22)',
              background: 'rgba(148,163,184,0.06)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
                alignItems: 'end',
              }}
            >
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Pilih Set</label>
                <select
                  className="form-input"
                  value={filters.selectedSetId}
                  onChange={(event) => setFilters((current) => ({ ...current, selectedSetId: event.target.value }))}
                  style={{ fontSize: '13px', fontWeight: 600 }}
                >
                  <option value="all">Semua Set ({uniqueSets.length})</option>
                  {uniqueSets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name} v{set.version} ({set.count} terapi)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Cari</label>
                <input
                  className="form-input"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Kode, keterangan, sesi, zat..."
                  style={{ fontSize: '13px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Status</label>
                <select
                  className="form-input"
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as TherapyPlanStatusFilter }))}
                  style={{ fontSize: '13px' }}
                >
                  <option value="all">Semua</option>
                  <option value="available">Belum Digunakan</option>
                  <option value="used">Sudah Digunakan</option>
                  <option value="superseded">History Edit</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Dari</label>
                <input
                  className="form-input"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                  style={{ fontSize: '13px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Sampai</label>
                <input
                  className="form-input"
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                  style={{ fontSize: '13px' }}
                />
              </div>

              <label
                style={{
                  minHeight: '42px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(20,184,166,0.28)',
                  background: filters.ifaOnly ? 'rgba(20,184,166,0.14)' : 'rgba(20,184,166,0.06)',
                  color: filters.ifaOnly ? '#5eead4' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={filters.ifaOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, ifaOnly: event.target.checked }))}
                />
                Zat Tambahan IFA
              </label>

              <button
                type="button"
                onClick={() => setFilters(createInitialFilters())}
                disabled={!hasActiveFilters}
                style={{
                  minHeight: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148,163,184,0.24)',
                  background: 'rgba(148,163,184,0.08)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
                  opacity: hasActiveFilters ? 1 : 0.55,
                }}
              >
                Reset
              </button>
            </div>

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.16)', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Menampilkan {filteredTherapyPlans.length} dari {therapyPlans.length} therapy plan dalam satu set.
            </div>
          </div>
        </>
      )}

      {therapyPlans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-lg)', border: '2px dashed rgba(148,163,184,0.2)' }}>
          <div style={{ fontSize: '48px', marginBottom: '14px' }}>TP</div>
          <p style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0', marginBottom: '8px' }}>
            Belum ada set therapy plan
          </p>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '18px' }}>
            Buat therapy plan melalui bulk agar semua rencana terapi tersimpan sebagai satu set.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setShowBulkModal(true)}>
            Buat Set Bulk
          </button>
        </div>
      ) : filteredTherapyPlans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '42px 24px', background: 'rgba(148,163,184,0.05)', borderRadius: '8px', border: '1px dashed rgba(148,163,184,0.24)' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Tidak ada therapy plan yang cocok
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Ubah filter atau reset untuk melihat semua data.
          </p>
          <button type="button" onClick={() => setFilters(createInitialFilters())} className="btn btn-secondary">
            Reset Filter
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {uniqueSets
            .filter((set) => groupedPlans.has(set.id))
            .map((set) => {
              const setPlans = groupedPlans.get(set.id) || [];
              const isCollapsed = collapsedSets.has(set.id);
              const setStats = {
                available: setPlans.filter((p) => getPlanStatusKey(p) === 'available').length,
                used: setPlans.filter((p) => getPlanStatusKey(p) === 'used').length,
                history: setPlans.filter((p) => getPlanStatusKey(p) === 'superseded').length,
              };

              return (
                <div
                  key={set.id}
                  style={{
                    border: '1px solid rgba(148,163,184,0.22)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'rgba(148,163,184,0.03)',
                  }}
                >
                  {/* Set Header */}
                  <button
                    onClick={() => toggleSetCollapse(set.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.08) 100%)',
                      border: 'none',
                      borderBottom: isCollapsed ? 'none' : '1px solid rgba(148,163,184,0.22)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(245,158,11,0.14) 100%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.08) 100%)';
                    }}
                  >
                    {isCollapsed ? (
                      <ChevronRight
                        style={{
                          width: '20px',
                          height: '20px',
                          color: 'var(--text-secondary)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <ChevronDown
                        style={{
                          width: '20px',
                          height: '20px',
                          color: 'var(--text-secondary)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
                          {set.name}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                          v{set.version}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(59,130,246,0.12)',
                            color: '#3b82f6',
                          }}
                        >
                          {setPlans.length} baris
                        </span>
                        {setStats.available > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'rgba(245,158,11,0.12)',
                              color: '#f59e0b',
                            }}
                          >
                            {setStats.available} tersedia
                          </span>
                        )}
                        {setStats.used > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'rgba(34,197,94,0.12)',
                              color: '#22c55e',
                            }}
                          >
                            {setStats.used} digunakan
                          </span>
                        )}
                        {setStats.history > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'rgba(148,163,184,0.12)',
                              color: '#94a3b8',
                            }}
                          >
                            {setStats.history} history
                          </span>
                        )}
                      </div>
                    </div>
                    {setStats.history === 0 && (setStats.available > 0 || setStats.used === 0) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSetClick(set.id);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: '6px',
                          border: '1px solid rgba(59,130,246,0.3)',
                          background: 'rgba(59,130,246,0.1)',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(59,130,246,0.2)';
                          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(59,130,246,0.1)';
                          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                        }}
                      >
                        Edit Set
                      </button>
                    )}
                  </button>

                  {/* Set Content */}
                  {!isCollapsed && (
                    <div style={{ padding: '0' }}>
                      <TherapyPlanListTable
                        plans={setPlans}
                        memberId={memberId}
                        onOpenSession={(sessionId) => router.push(`/sessions/${sessionId}`)}
                        onEdit={loadTherapyPlans}
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
