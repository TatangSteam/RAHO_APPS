'use client';

import { useState, useEffect } from 'react';
import { sessionApi } from '@/lib/sessionApi';
import { memberApi } from '@/lib/memberApi';
import { therapyPlanApi, type TherapyPlan } from '@/lib/therapyPlanApi';
import { usersApi, type StaffMember } from '@/lib/usersApi';
import { useAuthStore } from '@/stores/authStore';
import type { CreateSessionInput, SessionType } from '@/types/session';
import type { MemberPackage } from '@/types/member';
import { showToast } from '@/lib/toast';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
  preselectedMemberId?: string;
}

export default function CreateSessionModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedMemberId,
}: CreateSessionModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [memberId, setMemberId] = useState(preselectedMemberId || '');
  const [memberNo, setMemberNo] = useState('');
  const [memberName, setMemberName] = useState('');
  const [voucherCount, setVoucherCount] = useState(0);
  
  const [packages, setPackages] = useState<MemberPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [useBooster, setUseBooster] = useState(false);
  const [selectedBoosterPackageId, setSelectedBoosterPackageId] = useState('');
  
  const [therapyPlans, setTherapyPlans] = useState<TherapyPlan[]>([]);
  const [selectedTherapyPlanId, setSelectedTherapyPlanId] = useState('');
  const [loadingTherapyPlans, setLoadingTherapyPlans] = useState(false);
  
  const [doctors, setDoctors] = useState<StaffMember[]>([]);
  const [nurses, setNurses] = useState<StaffMember[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [additionalDoctorIds, setAdditionalDoctorIds] = useState<string[]>([]);
  const [additionalNurseIds, setAdditionalNurseIds] = useState<string[]>([]);
  
  // State for adding additional staff
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [tempDoctorId, setTempDoctorId] = useState('');
  const [showAddNurse, setShowAddNurse] = useState(false);
  const [tempNurseId, setTempNurseId] = useState('');
  
  const [treatmentDate, setTreatmentDate] = useState('');
  const [pelaksanaan, setPelaksanaan] = useState<SessionType>('ON_SITE');
  const [activeTab, setActiveTab] = useState<'form' | 'therapyPlan'>('form');

  // Load member data when memberId changes
  useEffect(() => {
    if (memberId) {
      loadMemberData(memberId);
      loadTherapyPlans(memberId);
    }
  }, [memberId]);

  // Load doctors and nurses on mount
  useEffect(() => {
    if (isOpen) {
      loadStaff();
      // Set default treatment date to now
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setTreatmentDate(localDateTime);
    }
  }, [isOpen]);

  const loadMemberData = async (id: string) => {
    try {
      const memberDetail = await memberApi.getMemberById(id);
      setMemberNo(memberDetail.memberNo);
      setMemberName(memberDetail.profile?.fullName || '');

      // Load packages
      const pkgs = await memberApi.getMemberPackages(id);
      console.log('Raw packages from API:', pkgs);
      
      // Flatten grouped packages structure
      const flatPackages: MemberPackage[] = [];
      pkgs.forEach((pkg: any) => {
        if (pkg.isGroup) {
          // Add basic packages from group (plural - array)
          if (pkg.basics && Array.isArray(pkg.basics)) {
            pkg.basics.forEach((basic: any) => {
              flatPackages.push({
                ...basic,
                packageType: basic.packageType as 'BASIC' | 'BOOSTER',
                status: basic.status as 'ACTIVE' | 'INACTIVE' | 'EXPIRED',
              });
            });
          }
          // Add booster packages from group (plural - array)
          if (pkg.boosters && Array.isArray(pkg.boosters)) {
            pkg.boosters.forEach((booster: any) => {
              flatPackages.push({
                ...booster,
                packageType: booster.packageType as 'BASIC' | 'BOOSTER',
                status: booster.status as 'ACTIVE' | 'INACTIVE' | 'EXPIRED',
              });
            });
          }
        } else {
          // Standalone package
          flatPackages.push({
            ...pkg,
            packageType: pkg.packageType as 'BASIC' | 'BOOSTER',
            status: pkg.status as 'ACTIVE' | 'INACTIVE' | 'EXPIRED',
          });
        }
      });

      console.log('Flattened packages:', flatPackages);

      // Filter only ACTIVE packages with remaining sessions
      const activePackages = flatPackages.filter(
        (p) => p.status === 'ACTIVE' && p.remainingSessions > 0
      );

      console.log('Active packages with remaining sessions:', activePackages);
      setPackages(activePackages);

      // Calculate total remaining sessions from BASIC packages
      const totalRemainingSessions = activePackages
        .filter((p) => p.packageType === 'BASIC')
        .reduce((sum, p) => sum + p.remainingSessions, 0);
      
      setVoucherCount(totalRemainingSessions);

      // Auto-select first BASIC package
      const basicPackage = activePackages.find((p) => p.packageType === 'BASIC');
      if (basicPackage) {
        setSelectedPackageId(basicPackage.packageId);
      }
    } catch (err: any) {
      console.error('Failed to load member data:', err);
      setError(err.response?.data?.error?.message || 'Gagal memuat data member');
    }
  };

  // Helper function to get package display name
  const getPackageDisplayName = (pkg: MemberPackage) => {
    // Check if this is a combined booster package (packageCode starts with "Booster")
    if (pkg.packageCode && pkg.packageCode.startsWith('Booster ')) {
      // This is a combined booster, just add session info
      return `${pkg.packageCode} - ${pkg.totalSessions} sesi (sisa: ${pkg.remainingSessions})`;
    }
    
    // Use productCode if available, otherwise fallback to packageCode
    const code = pkg.productCode || pkg.packageCode;
    
    if (pkg.packageType === 'BASIC') {
      // Product code format: TNB-P{sessions}-{serviceType}
      if (pkg.productCode) {
        const parts = pkg.productCode.split('-');
        if (parts[0] === 'TNB' && parts.length >= 2) {
          const sessionMatch = parts[1].match(/P(\d+)/);
          const sessions = sessionMatch ? sessionMatch[1] : pkg.totalSessions;
          const serviceType = parts[parts.length - 1];
          
          const serviceNames: Record<string, string> = {
            'HC': 'Homecare',
            'PS': 'Partnership',
            'PTY': 'Partnership Attiya',
            'PDA': 'Partnership Dr. Abhi',
            'PHC': 'Partnership Homecare'
          };
          
          const serviceName = serviceNames[serviceType] || serviceType;
          return `NB${sessions} - ${sessions} sesi (sisa: ${pkg.remainingSessions})`;
        }
      }
      // Fallback
      return `${code} - ${pkg.totalSessions} sesi (sisa: ${pkg.remainingSessions})`;
    } else {
      // BOOSTER package
      // Product code format: BST-{boosterType}-P1-{serviceType}
      if (pkg.productCode) {
        const parts = pkg.productCode.split('-');
        if (parts[0] === 'BST' && parts.length >= 2) {
          const boosterType = parts[1];
          const serviceType = parts[parts.length - 1];
          
          const boosterNames: Record<string, string> = {
            'NO': 'NO',
            'GT': 'GT',
            'MB': 'MB',
            'KCL': 'KCL',
            'H2S': 'H2S',
            'HK': 'H2S Konsentrat',
            'O3': 'O3',
            'HHO': 'HHO',
            'PST': 'NO',
            'NO2': 'NO'
          };
          
          const fullName = boosterNames[boosterType] || boosterType;
          return `Booster ${fullName} - ${pkg.totalSessions} sesi (sisa: ${pkg.remainingSessions})`;
        }
      }
      // Fallback
      return `Booster - ${pkg.totalSessions} sesi (sisa: ${pkg.remainingSessions})`;
    }
  };

  const loadTherapyPlans = async (id: string) => {
    try {
      setLoadingTherapyPlans(true);
      const plans = await therapyPlanApi.getMemberTherapyPlans(id);
      // Filter only unused plans
      const availablePlans = plans.filter(p => !p.isUsed);
      setTherapyPlans(availablePlans);
      
      // Auto-select first available plan
      if (availablePlans.length > 0) {
        setSelectedTherapyPlanId(availablePlans[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load therapy plans:', err);
      showToast.error('Gagal memuat therapy plans');
    } finally {
      setLoadingTherapyPlans(false);
    }
  };

  const loadStaff = async () => {
    try {
      // Load doctors and nurses from API
      const [doctorsList, nursesList] = await Promise.all([
        usersApi.getDoctors(user?.branchId || undefined),
        usersApi.getNurses(user?.branchId || undefined),
      ]);
      
      setDoctors(doctorsList);
      setNurses(nursesList);
    } catch (err) {
      console.error('Failed to load staff:', err);
      setError('Gagal memuat data dokter dan nakes');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!memberId) {
      setError('Member harus dipilih');
      return;
    }

    if (!selectedPackageId) {
      setError('Paket Basic harus dipilih');
      return;
    }

    if (useBooster && !selectedBoosterPackageId) {
      setError('Paket Booster harus dipilih jika menggunakan booster');
      return;
    }

    if (!selectedTherapyPlanId) {
      setError('Therapy plan harus dipilih');
      return;
    }

    if (!selectedDoctorId) {
      setError('Dokter harus dipilih');
      return;
    }

    if (!selectedNurseId) {
      setError('Nakes harus dipilih');
      return;
    }

    if (!treatmentDate) {
      setError('Tanggal & waktu terapi harus diisi');
      return;
    }

    // Validate selected package has remaining sessions
    const selectedPkg = packages.find(p => p.packageId === selectedPackageId);
    if (!selectedPkg || selectedPkg.remainingSessions <= 0) {
      setError('Paket yang dipilih tidak memiliki sesi tersisa');
      return;
    }

    // Validate booster package if selected
    if (useBooster && selectedBoosterPackageId) {
      const selectedBooster = packages.find(p => p.packageId === selectedBoosterPackageId);
      if (!selectedBooster || selectedBooster.remainingSessions <= 0) {
        setError('Paket booster yang dipilih tidak memiliki sesi tersisa');
        return;
      }
    }

    setLoading(true);

    try {
      const data: CreateSessionInput = {
        memberId,
        memberPackageId: selectedPackageId,
        boosterPackageId: useBooster ? selectedBoosterPackageId || undefined : undefined,
        therapyPlanId: selectedTherapyPlanId,
        adminLayananId: user?.userId || '',
        doctorId: selectedDoctorId,
        nurseId: selectedNurseId,
        additionalDoctorIds,
        additionalNurseIds,
        treatmentDate: new Date(treatmentDate).toISOString(),
        pelaksanaan,
      };

      console.log('Creating session with data:', data);
      const result = await sessionApi.createSession(data);
      showToast.success('Sesi terapi berhasil dibuat');
      onSuccess(result.sessionId);
    } catch (err: any) {
      console.error('Failed to create session:', err);
      const errorMessage = err.response?.data?.error?.message || err.message || 'Gagal membuat sesi';
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setMemberId('');
      setSelectedPackageId('');
      setUseBooster(false);
      setSelectedBoosterPackageId('');
      setSelectedDoctorId('');
      setSelectedNurseId('');
      setAdditionalDoctorIds([]);
      setAdditionalNurseIds([]);
      setShowAddDoctor(false);
      setTempDoctorId('');
      setShowAddNurse(false);
      setTempNurseId('');
      onClose();
    }
  };

  const handleAddDoctor = () => {
    if (tempDoctorId && !additionalDoctorIds.includes(tempDoctorId)) {
      setAdditionalDoctorIds([...additionalDoctorIds, tempDoctorId]);
      setTempDoctorId('');
      setShowAddDoctor(false);
    }
  };

  const handleRemoveDoctor = (doctorId: string) => {
    setAdditionalDoctorIds(additionalDoctorIds.filter(id => id !== doctorId));
  };

  const handleAddNurse = () => {
    if (tempNurseId && !additionalNurseIds.includes(tempNurseId)) {
      setAdditionalNurseIds([...additionalNurseIds, tempNurseId]);
      setTempNurseId('');
      setShowAddNurse(false);
    }
  };

  const handleRemoveNurse = (nurseId: string) => {
    setAdditionalNurseIds(additionalNurseIds.filter(id => id !== nurseId));
  };

  const getAvailableDoctors = () => {
    return doctors.filter(d => d.userId !== selectedDoctorId && !additionalDoctorIds.includes(d.userId));
  };

  const getAvailableNurses = () => {
    return nurses.filter(n => n.userId !== selectedNurseId && !additionalNurseIds.includes(n.userId));
  };

  if (!isOpen) return null;

  const basicPackages = packages.filter((p) => p.packageType === 'BASIC');
  
  // Group booster packages by name and combine remaining sessions
  const boosterPackagesRaw = packages.filter((p) => p.packageType === 'BOOSTER');
  const boosterPackagesMap = new Map<string, MemberPackage>();
  
  boosterPackagesRaw.forEach((pkg) => {
    const displayName = getPackageDisplayName(pkg);
    // Extract booster name without session info (e.g., "Booster GT" from "Booster GT - 1 sesi (sisa: 1)")
    const boosterNameMatch = displayName.match(/^(Booster\s+\w+)/);
    const boosterName = boosterNameMatch ? boosterNameMatch[1] : displayName;
    
    if (boosterPackagesMap.has(boosterName)) {
      // Combine with existing entry
      const existing = boosterPackagesMap.get(boosterName)!;
      boosterPackagesMap.set(boosterName, {
        ...existing,
        remainingSessions: existing.remainingSessions + pkg.remainingSessions,
        totalSessions: existing.totalSessions + pkg.totalSessions,
      });
    } else {
      // Add new entry with booster name as key
      boosterPackagesMap.set(boosterName, {
        ...pkg,
        // Store the booster name for display purposes
        packageCode: boosterName,
      });
    }
  });
  
  const boosterPackages = Array.from(boosterPackagesMap.values());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-border)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Buat Sesi Terapi Baru
            </h2>
            <button
              onClick={handleClose}
              disabled={loading}
              className="btn-icon"
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 border-b border-[var(--surface-border)] -mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'form'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Form Sesi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('therapyPlan')}
              disabled={!selectedTherapyPlanId}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'therapyPlan'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              } ${!selectedTherapyPlanId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Detail Therapy Plan
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Member Selection */}
              <div className="form-group">
                <label className="form-label">
                  Member <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  placeholder="Masukkan Member ID"
                  className="form-input"
                  disabled={loading || !!preselectedMemberId}
                />
                {memberNo && (
                  <div className="mt-2 p-3 bg-gray-500/10 rounded-lg">
                    <p className="text-sm text-[var(--text-secondary)]">
                      <span className="font-semibold">{memberNo}</span> - {memberName}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Voucher tersisa: <span className="font-semibold">{voucherCount}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Package Selection */}
              {packages.length === 0 && memberId ? (
                <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400 mb-2">
                    ⚠️ Member tidak memiliki paket ACTIVE dengan sesi tersisa
                  </p>
                  <p className="text-xs text-red-400/80">
                    Silakan assign paket terlebih dahulu di halaman detail member
                  </p>
                </div>
              ) : basicPackages.length > 0 ? (
                <div className="form-group">
                  <label className="form-label">
                    Paket Basic <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedPackageId}
                    onChange={(e) => setSelectedPackageId(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  >
                    <option value="">Pilih paket...</option>
                    {basicPackages.map((pkg) => (
                      <option key={pkg.packageId} value={pkg.packageId}>
                        {getPackageDisplayName(pkg)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Booster Package Selection */}
              {memberId && (
                <div className="form-group">
                  <label className="flex items-center cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={useBooster}
                      onChange={(e) => {
                        setUseBooster(e.target.checked);
                        if (!e.target.checked) {
                          setSelectedBoosterPackageId('');
                        }
                      }}
                      className="mr-2"
                      disabled={loading || boosterPackages.length === 0}
                    />
                    <span className="text-sm text-[var(--text-primary)] font-medium">
                      Gunakan Paket Booster
                    </span>
                  </label>
                  
                  {useBooster && (
                    <div className="mt-2">
                      {boosterPackages.length > 0 ? (
                        <>
                          <label className="form-label">
                            Pilih Paket Booster <span className="text-red-400">*</span>
                          </label>
                          <select
                            value={selectedBoosterPackageId}
                            onChange={(e) => setSelectedBoosterPackageId(e.target.value)}
                            className="form-input"
                            disabled={loading}
                          >
                            <option value="">Pilih paket booster...</option>
                            {boosterPackages.map((pkg) => (
                              <option key={pkg.packageId} value={pkg.packageId}>
                                {getPackageDisplayName(pkg)}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <div className="p-3 bg-yellow-500/15 border border-yellow-500/30 rounded-lg">
                          <p className="text-sm text-yellow-400 mb-2">
                            ⚠️ Member tidak memiliki paket booster ACTIVE
                          </p>
                          <p className="text-xs text-yellow-400/80">
                            Silakan assign paket booster terlebih dahulu di halaman detail member
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!useBooster && boosterPackages.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Member belum memiliki paket booster
                    </p>
                  )}
                </div>
              )}

              {/* Therapy Plan Selection */}
              <div className="form-group">
                <label className="form-label">
                  Therapy Plan <span className="text-red-400">*</span>
                </label>
                {loadingTherapyPlans ? (
                  <div className="p-3 bg-gray-500/10 rounded-lg text-sm text-[var(--text-secondary)]">
                    Memuat therapy plans...
                  </div>
                ) : therapyPlans.length === 0 ? (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400 mb-2">
                      ⚠️ Belum ada therapy plan yang tersedia
                    </p>
                    <p className="text-xs text-red-400/80">
                      Silakan buat therapy plan terlebih dahulu di tab Therapy Plan pada halaman detail member
                    </p>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedTherapyPlanId}
                      onChange={(e) => setSelectedTherapyPlanId(e.target.value)}
                      className="form-input"
                      disabled={loading}
                      required
                    >
                      <option value="">Pilih therapy plan...</option>
                      {therapyPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.planCode} - {new Date(plan.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </option>
                      ))}
                    </select>
                    {selectedTherapyPlanId && (
                      <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-blue-400 mb-1">
                          💡 Klik tab "Detail Therapy Plan" untuk melihat detail lengkap
                        </p>
                        {(() => {
                          const selected = therapyPlans.find(p => p.id === selectedTherapyPlanId);
                          if (!selected) return null;
                          const doses = [
                            selected.ifa && `IFA: ${selected.ifa}`,
                            selected.hho && `HHO: ${selected.hho}`,
                            selected.h2 && `H2: ${selected.h2}`,
                            selected.no && `NO: ${selected.no}`,
                          ].filter(Boolean);
                          return (
                            <p className="text-xs text-[var(--text-muted)]">
                              {doses.join(' • ')} {doses.length < 4 && '...'}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Doctor Selection */}
              <div className="form-group">
                <label className="form-label">
                  Dokter Utama <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="form-input"
                  disabled={loading}
                >
                  <option value="">Pilih dokter utama...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.userId} value={doctor.userId}>
                      {doctor.fullName} ({doctor.staffCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Doctors */}
              {selectedDoctorId && (
                <div className="form-group">
                  <label className="form-label">
                    Dokter Tambahan (Opsional)
                  </label>
                  
                  {/* List of added doctors */}
                  {additionalDoctorIds.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {additionalDoctorIds.map((doctorId) => {
                        const doctor = doctors.find(d => d.userId === doctorId);
                        if (!doctor) return null;
                        return (
                          <div 
                            key={doctorId} 
                            className="flex items-center justify-between p-3 rounded-lg"
                            style={{
                              background: 'var(--surface-input)',
                              border: '1px solid var(--surface-border)',
                            }}
                          >
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {doctor.fullName} ({doctor.staffCode})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDoctor(doctorId)}
                              className="transition-colors"
                              style={{ color: 'var(--color-error)' }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                              disabled={loading}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add doctor button/dropdown */}
                  {!showAddDoctor && getAvailableDoctors().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAddDoctor(true)}
                      className="w-full p-3 rounded-lg transition-all flex items-center justify-center gap-2"
                      style={{
                        border: '2px dashed var(--surface-border)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.color = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--surface-border)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                      disabled={loading}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="font-medium">Tambah Dokter</span>
                    </button>
                  )}

                  {/* Dropdown for selecting additional doctor */}
                  {showAddDoctor && (
                    <div className="space-y-2">
                      <select
                        value={tempDoctorId}
                        onChange={(e) => setTempDoctorId(e.target.value)}
                        className="form-input"
                        disabled={loading}
                      >
                        <option value="">Pilih dokter tambahan...</option>
                        {getAvailableDoctors().map((doctor) => (
                          <option key={doctor.userId} value={doctor.userId}>
                            {doctor.fullName} ({doctor.staffCode})
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAddDoctor}
                          disabled={!tempDoctorId || loading}
                          className="btn-primary flex-1"
                        >
                          Tambahkan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddDoctor(false);
                            setTempDoctorId('');
                          }}
                          className="btn-secondary flex-1"
                          disabled={loading}
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                  {getAvailableDoctors().length === 0 && additionalDoctorIds.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      Tidak ada dokter tambahan yang tersedia
                    </p>
                  )}
                </div>
              )}

              {/* Nurse Selection */}
              <div className="form-group">
                <label className="form-label">
                  Nakes Utama <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedNurseId}
                  onChange={(e) => setSelectedNurseId(e.target.value)}
                  className="form-input"
                  disabled={loading}
                >
                  <option value="">Pilih nakes utama...</option>
                  {nurses.map((nurse) => (
                    <option key={nurse.userId} value={nurse.userId}>
                      {nurse.fullName} ({nurse.staffCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Nurses */}
              {selectedNurseId && (
                <div className="form-group">
                  <label className="form-label">
                    Nakes Tambahan (Opsional)
                  </label>
                  
                  {/* List of added nurses */}
                  {additionalNurseIds.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {additionalNurseIds.map((nurseId) => {
                        const nurse = nurses.find(n => n.userId === nurseId);
                        if (!nurse) return null;
                        return (
                          <div 
                            key={nurseId} 
                            className="flex items-center justify-between p-3 rounded-lg"
                            style={{
                              background: 'var(--surface-input)',
                              border: '1px solid var(--surface-border)',
                            }}
                          >
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {nurse.fullName} ({nurse.staffCode})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveNurse(nurseId)}
                              className="transition-colors"
                              style={{ color: 'var(--color-error)' }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                              disabled={loading}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add nurse button/dropdown */}
                  {!showAddNurse && getAvailableNurses().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAddNurse(true)}
                      className="w-full p-3 rounded-lg transition-all flex items-center justify-center gap-2"
                      style={{
                        border: '2px dashed var(--surface-border)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.color = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--surface-border)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                      disabled={loading}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="font-medium">Tambah Nakes</span>
                    </button>
                  )}

                  {/* Dropdown for selecting additional nurse */}
                  {showAddNurse && (
                    <div className="space-y-2">
                      <select
                        value={tempNurseId}
                        onChange={(e) => setTempNurseId(e.target.value)}
                        className="form-input"
                        disabled={loading}
                      >
                        <option value="">Pilih nakes tambahan...</option>
                        {getAvailableNurses().map((nurse) => (
                          <option key={nurse.userId} value={nurse.userId}>
                            {nurse.fullName} ({nurse.staffCode})
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAddNurse}
                          disabled={!tempNurseId || loading}
                          className="btn-primary flex-1"
                        >
                          Tambahkan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddNurse(false);
                            setTempNurseId('');
                          }}
                          className="btn-secondary flex-1"
                          disabled={loading}
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                  {getAvailableNurses().length === 0 && additionalNurseIds.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      Tidak ada nakes tambahan yang tersedia
                    </p>
                  )}
                </div>
              )}

              {/* Treatment Date */}
              <div className="form-group">
                <label className="form-label">
                  Tanggal & Waktu Terapi <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={treatmentDate}
                  onChange={(e) => setTreatmentDate(e.target.value)}
                  className="form-input"
                  disabled={loading}
                />
              </div>

              {/* Pelaksanaan */}
              <div className="form-group">
                <label className="form-label">
                  Pelaksanaan <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="ON_SITE"
                      checked={pelaksanaan === 'ON_SITE'}
                      onChange={(e) => setPelaksanaan(e.target.value as SessionType)}
                      className="mr-2"
                      disabled={loading}
                    />
                    <span className="text-sm text-[var(--text-primary)]">On Site</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="HOME_CARE"
                      checked={pelaksanaan === 'HOME_CARE'}
                      onChange={(e) => setPelaksanaan(e.target.value as SessionType)}
                      className="mr-2"
                      disabled={loading}
                    />
                    <span className="text-sm text-[var(--text-primary)]">Home Care</span>
                  </label>
                </div>
              </div>
            </form>
          ) : (
            /* Therapy Plan Detail Tab */
            <div className="space-y-4">
              {(() => {
                const selected = therapyPlans.find(p => p.id === selectedTherapyPlanId);
                if (!selected) {
                  return (
                    <div className="p-4 bg-gray-500/10 rounded-lg text-center">
                      <p className="text-sm text-[var(--text-secondary)]">
                        Pilih therapy plan terlebih dahulu
                      </p>
                    </div>
                  );
                }

                const materials = [
                  { label: 'IFA', value: selected.ifa, unit: 'mg' },
                  { label: 'HHO', value: selected.hho, unit: 'ml' },
                  { label: 'H2', value: selected.h2, unit: 'ml' },
                  { label: 'NO', value: selected.no, unit: 'ml' },
                  { label: 'GASO', value: selected.gaso, unit: 'ml' },
                  { label: 'O2', value: selected.o2, unit: 'ml' },
                  { label: 'O3', value: selected.o3, unit: 'ml' },
                  { label: 'EDTA', value: selected.edta, unit: 'ml' },
                  { label: 'MB', value: selected.mb, unit: 'ml' },
                  { label: 'H2S', value: selected.h2s, unit: 'ml' },
                  { label: 'KCL', value: selected.kcl, unit: 'ml' },
                  { label: 'JML NB', value: selected.jmlNb, unit: 'ml' },
                ];

                return (
                  <>
                    {/* Header Info */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                        {selected.planCode}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Dibuat: {new Date(selected.createdAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {selected.keterangan && (
                        <p className="text-sm text-[var(--text-secondary)] mt-2 pt-2 border-t border-blue-500/20">
                          {selected.keterangan}
                        </p>
                      )}
                    </div>

                    {/* Materials Grid */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                        Komposisi Material
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {materials.map((material) => (
                          <div
                            key={material.label}
                            className={`p-3 rounded-lg border ${
                              material.value && Number(material.value) > 0
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-gray-500/5 border-gray-500/20'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-[var(--text-secondary)]">
                                {material.label}
                              </span>
                              <span className={`text-sm font-semibold ${
                                material.value && Number(material.value) > 0
                                  ? 'text-green-400'
                                  : 'text-[var(--text-muted)]'
                              }`}>
                                {material.value && Number(material.value) > 0
                                  ? `${material.value} ${material.unit}`
                                  : '-'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-gray-500/10 rounded-lg">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Ringkasan
                      </h4>
                      <div className="space-y-1">
                        <p className="text-xs text-[var(--text-secondary)]">
                          Total material aktif: <span className="font-semibold">
                            {materials.filter(m => m.value && Number(m.value) > 0).length} dari {materials.length}
                          </span>
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Status: <span className="font-semibold text-green-400">
                            {selected.isUsed ? 'Sudah digunakan' : 'Tersedia'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--surface-border)] flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="btn btn-secondary"
          >
            Batal
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={
              loading || 
              !memberId || 
              !selectedPackageId || 
              !selectedTherapyPlanId || 
              !selectedDoctorId || 
              !selectedNurseId || 
              !treatmentDate ||
              therapyPlans.length === 0 ||
              (useBooster && !selectedBoosterPackageId)
            }
            className="btn btn-primary"
            title={
              !memberId ? 'Pilih member terlebih dahulu' :
              !selectedPackageId ? 'Pilih paket basic terlebih dahulu' :
              therapyPlans.length === 0 ? 'Belum ada therapy plan tersedia' :
              !selectedTherapyPlanId ? 'Pilih therapy plan terlebih dahulu' :
              !selectedDoctorId ? 'Pilih dokter terlebih dahulu' :
              !selectedNurseId ? 'Pilih nakes terlebih dahulu' :
              !treatmentDate ? 'Isi tanggal & waktu terapi' :
              (useBooster && !selectedBoosterPackageId) ? 'Pilih paket booster' :
              'Buat sesi terapi baru'
            }
          >
            {loading ? (
              <>
                <span className="spinner w-4 h-4"></span>
                Membuat...
              </>
            ) : (
              'Buat Sesi'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
