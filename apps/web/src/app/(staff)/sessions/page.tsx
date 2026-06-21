'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { branchesApi } from '@/lib/api/branchesApi';
import { api } from '@/lib/api';
import type { SessionDetail } from '@/types/session';
import styles from './page.module.css';
import { devError } from '@/lib/logger';

// Types for filter options
interface Branch {
  id: string;
  name: string;
  branchCode: string;
}

interface Staff {
  id: string;
  fullName: string;
  role: string;
}

export default function SessionsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [nurses, setNurses] = useState<Staff[]>([]);
  
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'completed' | 'incomplete',
    branchId: '',
    doctorId: '',
    nurseId: '',
    dateFrom: '',
    dateTo: '',
    pelaksanaan: 'all' as 'all' | 'ON_SITE' | 'HOME_CARE',
  });

  // Export modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  
  // Detailed field selection like Odoo
  const [exportFields, setExportFields] = useState({
    // Basic Info
    sessionCode: true,
    treatmentDate: true,
    treatmentTime: true,
    status: true,
    pelaksanaan: true,
    infusKe: true,
    branchName: true,
    branchCode: false,
    boosterType: false,
    
    // Member Info
    memberNo: true,
    memberName: true,
    memberPhone: false,
    memberEmail: false,
    packageCode: false,
    
    // Staff Info
    adminLayanan: false,
    doctorName: true,
    doctorCode: false,
    nurseName: true,
    nurseCode: false,
    allDoctors: false,
    allNurses: false,
    
    // Vital Signs Before
    sistolBefore: false,
    diastolBefore: false,
    hrBefore: false,
    saturasiBefore: false,
    piBefore: false,
    
    // Vital Signs After
    sistolAfter: false,
    diastolAfter: false,
    hrAfter: false,
    saturasiAfter: false,
    piAfter: false,
    
    // Therapy Plan
    planIfa: false,
    planHho: false,
    planH2: false,
    planNo: false,
    planGaso: false,
    planO2: false,
    planO3: false,
    planEdta: false,
    planMb: false,
    planH2s: false,
    planKcl: false,
    planJmlNb: false,
    planKeterangan: false,
    
    // Infusion Actual
    aktualIfa: false,
    aktualHho: false,
    aktualH2: false,
    aktualNo: false,
    aktualGaso: false,
    aktualO2: false,
    aktualO3: false,
    aktualEdta: false,
    aktualMb: false,
    aktualH2s: false,
    aktualKcl: false,
    aktualJmlNb: false,
    bottleType: false,
    jenisCairan: false,
    volumeCarrier: false,
    jumlahJarum: false,
    deviationNotes: false,
    
    // Materials
    materialsSummary: false,
    
    // Evaluation (SOAP)
    keluhan: false,
    rekomendasi: false,
    subjective: false,
    objective: false,
    assessment: false,
    plan: false,
    generalNotes: false,
  });

  // Field categories for UI grouping
  const fieldCategories = [
    {
      id: 'basic',
      label: 'Info Dasar',
      icon: '📋',
      fields: [
        { key: 'sessionCode', label: 'Kode Sesi' },
        { key: 'treatmentDate', label: 'Tanggal Terapi' },
        { key: 'treatmentTime', label: 'Waktu Terapi' },
        { key: 'status', label: 'Status' },
        { key: 'pelaksanaan', label: 'Tipe Pelaksanaan' },
        { key: 'infusKe', label: 'Infus Ke' },
        { key: 'branchName', label: 'Nama Cabang' },
        { key: 'branchCode', label: 'Kode Cabang' },
        { key: 'boosterType', label: 'Tipe Booster' },
      ],
    },
    {
      id: 'member',
      label: 'Info Member',
      icon: '👤',
      fields: [
        { key: 'memberNo', label: 'No. Member' },
        { key: 'memberName', label: 'Nama Member' },
        { key: 'memberPhone', label: 'Telepon Member' },
        { key: 'memberEmail', label: 'Email Member' },
        { key: 'packageCode', label: 'Kode Paket' },
      ],
    },
    {
      id: 'staff',
      label: 'Info Staff',
      icon: '👨‍⚕️',
      fields: [
        { key: 'adminLayanan', label: 'Admin Layanan' },
        { key: 'doctorName', label: 'Nama Dokter Utama' },
        { key: 'doctorCode', label: 'Kode Dokter' },
        { key: 'nurseName', label: 'Nama Nakes Utama' },
        { key: 'nurseCode', label: 'Kode Nakes' },
        { key: 'allDoctors', label: 'Semua Dokter' },
        { key: 'allNurses', label: 'Semua Nakes' },
      ],
    },
    {
      id: 'vitalBefore',
      label: 'Vital Sign (Sebelum)',
      icon: '❤️',
      fields: [
        { key: 'sistolBefore', label: 'Sistol' },
        { key: 'diastolBefore', label: 'Diastol' },
        { key: 'hrBefore', label: 'Heart Rate' },
        { key: 'saturasiBefore', label: 'Saturasi O2' },
        { key: 'piBefore', label: 'PI' },
      ],
    },
    {
      id: 'vitalAfter',
      label: 'Vital Sign (Sesudah)',
      icon: '💚',
      fields: [
        { key: 'sistolAfter', label: 'Sistol' },
        { key: 'diastolAfter', label: 'Diastol' },
        { key: 'hrAfter', label: 'Heart Rate' },
        { key: 'saturasiAfter', label: 'Saturasi O2' },
        { key: 'piAfter', label: 'PI' },
      ],
    },
    {
      id: 'therapyPlan',
      label: 'Rencana Terapi',
      icon: '📝',
      fields: [
        { key: 'planIfa', label: 'IFA' },
        { key: 'planHho', label: 'HHO' },
        { key: 'planH2', label: 'H2' },
        { key: 'planNo', label: 'NO' },
        { key: 'planGaso', label: 'GASO' },
        { key: 'planO2', label: 'O2' },
        { key: 'planO3', label: 'O3' },
        { key: 'planEdta', label: 'EDTA' },
        { key: 'planMb', label: 'MB' },
        { key: 'planH2s', label: 'H2S' },
        { key: 'planKcl', label: 'KCL' },
        { key: 'planJmlNb', label: 'JML NB' },
        { key: 'planKeterangan', label: 'Keterangan' },
      ],
    },
    {
      id: 'infusion',
      label: 'Infus Aktual',
      icon: '💉',
      fields: [
        { key: 'aktualIfa', label: 'IFA' },
        { key: 'aktualHho', label: 'HHO' },
        { key: 'aktualH2', label: 'H2' },
        { key: 'aktualNo', label: 'NO' },
        { key: 'aktualGaso', label: 'GASO' },
        { key: 'aktualO2', label: 'O2' },
        { key: 'aktualO3', label: 'O3' },
        { key: 'aktualEdta', label: 'EDTA' },
        { key: 'aktualMb', label: 'MB' },
        { key: 'aktualH2s', label: 'H2S' },
        { key: 'aktualKcl', label: 'KCL' },
        { key: 'aktualJmlNb', label: 'JML NB' },
        { key: 'bottleType', label: 'Jenis Botol' },
        { key: 'jenisCairan', label: 'Jenis Cairan' },
        { key: 'volumeCarrier', label: 'Volume Carrier' },
        { key: 'jumlahJarum', label: 'Jumlah Jarum' },
        { key: 'deviationNotes', label: 'Catatan Deviasi' },
      ],
    },
    {
      id: 'materials',
      label: 'Material',
      icon: '📦',
      fields: [
        { key: 'materialsSummary', label: 'Ringkasan Material' },
      ],
    },
    {
      id: 'evaluation',
      label: 'Evaluasi Dokter',
      icon: '📄',
      fields: [
        { key: 'keluhan', label: 'Keluhan' },
        { key: 'rekomendasi', label: 'Rekomendasi' },
        { key: 'subjective', label: 'Subjective' },
        { key: 'objective', label: 'Objective' },
        { key: 'assessment', label: 'Assessment' },
        { key: 'plan', label: 'Plan' },
        { key: 'generalNotes', label: 'Catatan Umum' },
      ],
    },
  ];

  // Expanded categories state
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['basic', 'member']);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleAllInCategory = (categoryId: string, checked: boolean) => {
    const category = fieldCategories.find(c => c.id === categoryId);
    if (category) {
      const updates: any = {};
      category.fields.forEach(field => {
        updates[field.key] = checked;
      });
      setExportFields(prev => ({ ...prev, ...updates }));
    }
  };

  const isCategoryFullySelected = (categoryId: string) => {
    const category = fieldCategories.find(c => c.id === categoryId);
    if (!category) return false;
    return category.fields.every(field => exportFields[field.key as keyof typeof exportFields]);
  };

  const isCategoryPartiallySelected = (categoryId: string) => {
    const category = fieldCategories.find(c => c.id === categoryId);
    if (!category) return false;
    const selectedCount = category.fields.filter(field => exportFields[field.key as keyof typeof exportFields]).length;
    return selectedCount > 0 && selectedCount < category.fields.length;
  };

  const selectAllFields = () => {
    const allTrue: any = {};
    Object.keys(exportFields).forEach(key => {
      allTrue[key] = true;
    });
    setExportFields(allTrue);
  };

  const deselectAllFields = () => {
    const allFalse: any = {};
    Object.keys(exportFields).forEach(key => {
      allFalse[key] = false;
    });
    setExportFields(allFalse);
  };

  const getSelectedFieldCount = () => {
    return Object.values(exportFields).filter(v => v).length;
  };

  // Check if user can see all branches
  const canSeeAllBranches = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

  // Load filter options
  useEffect(() => {
    // Skip if user is not loaded yet
    if (!user) return;
    
    const loadFilterOptions = async () => {
      try {
        // Load branches only for SUPER_ADMIN and ADMIN_MANAGER
        if (canSeeAllBranches) {
          const branchesRes = await branchesApi.listBranches();
          setBranches(branchesRes.data?.data || []);
        }

        // Load staff (doctors and nurses) using role-specific endpoint
        // This endpoint is accessible by all staff roles
        const [doctorsRes, nursesRes] = await Promise.all([
          api.get('/users/staff/DOCTOR'),
          api.get('/users/staff/NURSE'),
        ]);
        
        const doctorsList = doctorsRes.data?.data || [];
        const nursesList = nursesRes.data?.data || [];
        
        setDoctors(doctorsList.map((u: any) => ({
          id: u.id,
          fullName: u.profile?.fullName || u.email,
          role: u.role,
        })));
        setNurses(nursesList.map((u: any) => ({
          id: u.id,
          fullName: u.profile?.fullName || u.email,
          role: u.role,
        })));
      } catch (error) {
        devError('Error loading filter options:', error);
      }
    };

    loadFilterOptions();
  }, [user, canSeeAllBranches]);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit };
      
      // Apply filters
      if (filters.branchId) params.branchId = filters.branchId;
      if (filters.doctorId) params.doctorId = filters.doctorId;
      if (filters.nurseId) params.nurseId = filters.nurseId;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.pelaksanaan !== 'all') params.pelaksanaan = filters.pelaksanaan;

      const response = await sessionApi.getAllSessions(params);
      setSessions(response || []);
      
      // Estimate total pages
      if (response && response.length < limit) {
        setTotalPages(page);
      } else if (response && response.length === limit) {
        setTotalPages(page + 1);
      }
    } catch (error: any) {
      devError('Error loading sessions:', error);
      showToast.error('Gagal memuat data sesi terapi');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filter changes
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      branchId: '',
      doctorId: '',
      nurseId: '',
      dateFrom: '',
      dateTo: '',
      pelaksanaan: 'all',
    });
    setPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const blob = await sessionApi.exportSessions({
        format: exportFormat,
        fields: exportFields,
        filters: {
          branchId: filters.branchId || undefined,
          doctorId: filters.doctorId || undefined,
          nurseId: filters.nurseId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          status: filters.status !== 'all' ? filters.status : undefined,
          pelaksanaan: filters.pelaksanaan !== 'all' ? filters.pelaksanaan : undefined,
        },
      });

      // Download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sesi-terapi-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast.success('Export berhasil!');
      setShowExportModal(false);
    } catch (error: any) {
      devError('Export error:', error);
      showToast.error('Gagal mengexport data');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'status' || key === 'pelaksanaan') return value !== 'all';
    return value !== '';
  }).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Sesi Terapi</h1>
          <p className={styles.subtitle}>Daftar semua sesi terapi</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`btn btn-secondary ${styles.filterBtn} ${activeFilterCount > 0 ? styles.hasFilters : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            🔍 Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowExportModal(true)}
          >
            📥 Export
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterGrid}>
            {/* Status Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Status</label>
              <select
                className={styles.filterSelect}
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="completed">Selesai</option>
                <option value="incomplete">Belum Selesai</option>
              </select>
            </div>

            {/* Branch Filter - Only for SUPER_ADMIN and ADMIN_MANAGER */}
            {canSeeAllBranches && (
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Cabang</label>
                <select
                  className={styles.filterSelect}
                  value={filters.branchId}
                  onChange={(e) => handleFilterChange('branchId', e.target.value)}
                >
                  <option value="">Semua Cabang</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Doctor Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Dokter</label>
              <select
                className={styles.filterSelect}
                value={filters.doctorId}
                onChange={(e) => handleFilterChange('doctorId', e.target.value)}
              >
                <option value="">Semua Dokter</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Nurse Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Nakes</label>
              <select
                className={styles.filterSelect}
                value={filters.nurseId}
                onChange={(e) => handleFilterChange('nurseId', e.target.value)}
              >
                <option value="">Semua Nakes</option>
                {nurses.map((nurse) => (
                  <option key={nurse.id} value={nurse.id}>
                    {nurse.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Dari Tanggal</label>
              <input
                type="date"
                className={styles.filterInput}
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sampai Tanggal</label>
              <input
                type="date"
                className={styles.filterInput}
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            {/* Pelaksanaan Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Tipe Pelaksanaan</label>
              <select
                className={styles.filterSelect}
                value={filters.pelaksanaan}
                onChange={(e) => handleFilterChange('pelaksanaan', e.target.value)}
              >
                <option value="all">Semua Tipe</option>
                <option value="ON_SITE">On-Site</option>
                <option value="HOME_CARE">Home Care</option>
              </select>
            </div>
          </div>

          <div className={styles.filterActions}>
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Reset Filter
            </button>
          </div>
        </div>
      )}

      {/* Quick Status Tabs */}
      <div className={styles.filterTabs}>
        <button
          className={`${styles.filterTab} ${filters.status === 'all' ? styles.active : ''}`}
          onClick={() => handleFilterChange('status', 'all')}
        >
          Semua ({sessions.length})
        </button>
        <button
          className={`${styles.filterTab} ${filters.status === 'incomplete' ? styles.active : ''}`}
          onClick={() => handleFilterChange('status', 'incomplete')}
        >
          Belum Selesai
        </button>
        <button
          className={`${styles.filterTab} ${filters.status === 'completed' ? styles.active : ''}`}
          onClick={() => handleFilterChange('status', 'completed')}
        >
          Selesai
        </button>
      </div>

      {/* Sessions Table */}
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Memuat data...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💉</div>
          <p className={styles.emptyText}>Tidak ada sesi terapi</p>
          <p className={styles.emptySubtext}>
            {activeFilterCount > 0 
              ? 'Coba ubah filter untuk melihat data lainnya'
              : 'Sesi terapi akan muncul di sini setelah dibuat'}
          </p>
          {activeFilterCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters} style={{ marginTop: 16 }}>
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.sessionsTable}>
            <thead>
              <tr>
                <th>Kode Sesi</th>
                <th>Status</th>
                <th>Member</th>
                <th>Tanggal</th>
                <th>Waktu</th>
                <th>Sesi #</th>
                <th>Tipe</th>
                <th>Dokter</th>
                <th>Nakes</th>
                <th>Cabang</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((sessionDetail) => (
                <tr
                  key={sessionDetail.session.sessionId}
                  className={`${styles.tableRow} ${sessionDetail.session.isCompleted ? styles.completed : styles.incomplete}`}
                  onClick={() => handleSessionClick(sessionDetail.session.sessionId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSessionClick(sessionDetail.session.sessionId);
                    }
                  }}
                >
                  <td className={styles.sessionCodeCell}>
                    <span className={styles.sessionCode}>{sessionDetail.session.sessionCode}</span>
                    {sessionDetail.session.boosterPackage?.boosterType && (
                      <span className={styles.boosterTag}>⚡ {sessionDetail.session.boosterPackage.boosterType}</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        sessionDetail.session.isCompleted ? styles.statusCompleted : styles.statusIncomplete
                      }`}
                    >
                      {sessionDetail.session.isCompleted ? '✓ Selesai' : '⏳ Belum Selesai'}
                    </span>
                  </td>
                  <td className={styles.memberCell}>
                    <div className={styles.memberName}>{sessionDetail.session.member.fullName}</div>
                    <div className={styles.memberNo}>{sessionDetail.session.member.memberNo}</div>
                  </td>
                  <td className={styles.dateCell}>{formatDate(sessionDetail.session.treatmentDate)}</td>
                  <td className={styles.timeCell}>{formatTime(sessionDetail.session.treatmentDate)}</td>
                  <td className={styles.sessionNumberCell}>
                    <div className={styles.sessionGlobal}>#{sessionDetail.session.infusKe}</div>
                    {sessionDetail.session.branchInfusKe && sessionDetail.session.branchInfusKe !== sessionDetail.session.infusKe && (
                      <div className={styles.sessionBranch}>Cabang: #{sessionDetail.session.branchInfusKe}</div>
                    )}
                  </td>
                  <td className={styles.typeCell}>
                    {sessionDetail.session.pelaksanaan === 'ON_SITE' ? '🏥 On-Site' : '🏠 Home Care'}
                  </td>
                  <td className={styles.staffCell}>{sessionDetail.session.doctor?.fullName || '-'}</td>
                  <td className={styles.staffCell}>{sessionDetail.session.nurse?.fullName || '-'}</td>
                  <td className={styles.branchCell}>{sessionDetail.session.branchName || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={`btn btn-secondary ${styles.pageBtn}`}
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Sebelumnya
          </button>
          <span className={styles.pageInfo}>
            Halaman {page} dari {totalPages}
          </span>
          <button
            className={`btn btn-secondary ${styles.pageBtn}`}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Selanjutnya →
          </button>
        </div>
      )}

      {/* Export Modal - Odoo Style */}
      {showExportModal && (
        <div className={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
          <div className={styles.exportModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📥 Export Data Sesi Terapi</h2>
              <button className={styles.closeBtn} onClick={() => setShowExportModal(false)}>×</button>
            </div>
            
            <div className={styles.exportModalBody}>
              {/* Left Panel - Field Selection */}
              <div className={styles.fieldSelectionPanel}>
                <div className={styles.fieldSelectionHeader}>
                  <h3>Pilih Field untuk Export</h3>
                  <div className={styles.fieldSelectionActions}>
                    <button 
                      className={styles.selectAllBtn}
                      onClick={selectAllFields}
                    >
                      Pilih Semua
                    </button>
                    <button 
                      className={styles.deselectAllBtn}
                      onClick={deselectAllFields}
                    >
                      Hapus Semua
                    </button>
                  </div>
                </div>
                
                <div className={styles.fieldCategories}>
                  {fieldCategories.map((category) => (
                    <div key={category.id} className={styles.fieldCategory}>
                      <div 
                        className={styles.categoryHeader}
                        onClick={() => toggleCategory(category.id)}
                      >
                        <div className={styles.categoryLeft}>
                          <input
                            type="checkbox"
                            checked={isCategoryFullySelected(category.id)}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = isCategoryPartiallySelected(category.id);
                              }
                            }}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleAllInCategory(category.id, e.target.checked);
                            }}
                            className={styles.categoryCheckbox}
                          />
                          <span className={styles.categoryIcon}>{category.icon}</span>
                          <span className={styles.categoryLabel}>{category.label}</span>
                          <span className={styles.categoryCount}>
                            ({category.fields.filter(f => exportFields[f.key as keyof typeof exportFields]).length}/{category.fields.length})
                          </span>
                        </div>
                        <span className={`${styles.expandIcon} ${expandedCategories.includes(category.id) ? styles.expanded : ''}`}>
                          ▶
                        </span>
                      </div>
                      
                      {expandedCategories.includes(category.id) && (
                        <div className={styles.categoryFields}>
                          {category.fields.map((field) => (
                            <label key={field.key} className={styles.fieldItem}>
                              <input
                                type="checkbox"
                                checked={exportFields[field.key as keyof typeof exportFields]}
                                onChange={(e) => setExportFields(prev => ({ 
                                  ...prev, 
                                  [field.key]: e.target.checked 
                                }))}
                              />
                              <span>{field.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel - Export Options */}
              <div className={styles.exportOptionsPanel}>
                <div className={styles.exportOption}>
                  <h4>Format File</h4>
                  <div className={styles.formatButtons}>
                    <button
                      className={`${styles.formatBtn} ${exportFormat === 'xlsx' ? styles.active : ''}`}
                      onClick={() => setExportFormat('xlsx')}
                    >
                      <span className={styles.formatBtnIcon}>📊</span>
                      <span className={styles.formatBtnLabel}>Excel</span>
                      <span className={styles.formatBtnExt}>.xlsx</span>
                    </button>
                    <button
                      className={`${styles.formatBtn} ${exportFormat === 'csv' ? styles.active : ''}`}
                      onClick={() => setExportFormat('csv')}
                    >
                      <span className={styles.formatBtnIcon}>📄</span>
                      <span className={styles.formatBtnLabel}>CSV</span>
                      <span className={styles.formatBtnExt}>.csv</span>
                    </button>
                  </div>
                </div>

                <div className={styles.exportOption}>
                  <h4>Ringkasan Export</h4>
                  <div className={styles.exportSummary}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Field dipilih</span>
                      <span className={styles.summaryValue}>{getSelectedFieldCount()} kolom</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Format</span>
                      <span className={styles.summaryValue}>{exportFormat.toUpperCase()}</span>
                    </div>
                    {activeFilterCount > 0 && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Filter aktif</span>
                        <span className={styles.summaryValue}>{activeFilterCount} filter</span>
                      </div>
                    )}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <div className={styles.exportOption}>
                    <h4>Filter Aktif</h4>
                    <div className={styles.activeFilters}>
                      {filters.status !== 'all' && (
                        <span className={styles.filterTag}>
                          Status: {filters.status === 'completed' ? 'Selesai' : 'Belum Selesai'}
                        </span>
                      )}
                      {filters.branchId && (
                        <span className={styles.filterTag}>
                          Cabang: {branches.find(b => b.id === filters.branchId)?.name || filters.branchId}
                        </span>
                      )}
                      {filters.doctorId && (
                        <span className={styles.filterTag}>
                          Dokter: {doctors.find(d => d.id === filters.doctorId)?.fullName || filters.doctorId}
                        </span>
                      )}
                      {filters.nurseId && (
                        <span className={styles.filterTag}>
                          Nakes: {nurses.find(n => n.id === filters.nurseId)?.fullName || filters.nurseId}
                        </span>
                      )}
                      {filters.dateFrom && (
                        <span className={styles.filterTag}>
                          Dari: {filters.dateFrom}
                        </span>
                      )}
                      {filters.dateTo && (
                        <span className={styles.filterTag}>
                          Sampai: {filters.dateTo}
                        </span>
                      )}
                      {filters.pelaksanaan !== 'all' && (
                        <span className={styles.filterTag}>
                          Tipe: {filters.pelaksanaan === 'ON_SITE' ? 'On-Site' : 'Home Care'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles.exportActions}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowExportModal(false)}
                  >
                    Batal
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleExport}
                    disabled={exporting || getSelectedFieldCount() === 0}
                  >
                    {exporting ? (
                      <>
                        <span className={styles.exportSpinner}></span>
                        Mengexport...
                      </>
                    ) : (
                      <>📥 Export {getSelectedFieldCount()} Kolom</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
