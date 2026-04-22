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
  
  const [treatmentDate, setTreatmentDate] = useState('');
  const [pelaksanaan, setPelaksanaan] = useState<SessionType>('ON_SITE');

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
          // Add basic package from group
          if (pkg.basic) {
            flatPackages.push({
              ...pkg.basic,
              packageType: pkg.basic.packageType as 'BASIC' | 'BOOSTER',
              status: pkg.basic.status as 'ACTIVE' | 'INACTIVE' | 'EXPIRED',
            });
          }
          // Add booster package from group
          if (pkg.booster) {
            flatPackages.push({
              ...pkg.booster,
              packageType: pkg.booster.packageType as 'BASIC' | 'BOOSTER',
              status: pkg.booster.status as 'ACTIVE' | 'INACTIVE' | 'EXPIRED',
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
      onClose();
    }
  };

  if (!isOpen) return null;

  const basicPackages = packages.filter((p) => p.packageType === 'BASIC');
  const boosterPackages = packages.filter((p) => p.packageType === 'BOOSTER');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-border)] flex justify-between items-center">
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="space-y-5">
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
            {boosterPackages.length > 0 && (
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
                    disabled={loading}
                  />
                  <span className="text-sm text-[var(--text-primary)] font-medium">
                    Gunakan Paket Booster
                  </span>
                </label>
                
                {useBooster && (
                  <div className="mt-2">
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
                  </div>
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
                      {(() => {
                        const selected = therapyPlans.find(p => p.id === selectedTherapyPlanId);
                        if (!selected) return null;
                        const doses = [
                          selected.ifa && `IFA: ${selected.ifa}`,
                          selected.hho && `HHO: ${selected.hho}`,
                          selected.h2 && `H2: ${selected.h2}`,
                          selected.no && `NO: ${selected.no}`,
                          selected.gaso && `GASO: ${selected.gaso}`,
                          selected.o2 && `O2: ${selected.o2}`,
                          selected.o3 && `O3: ${selected.o3}`,
                          selected.edta && `EDTA: ${selected.edta}`,
                          selected.mb && `MB: ${selected.mb}`,
                          selected.h2s && `H2S: ${selected.h2s}`,
                          selected.kcl && `KCL: ${selected.kcl}`,
                          selected.jmlNb && `JML NB: ${selected.jmlNb}`,
                        ].filter(Boolean);
                        return (
                          <>
                            {selected.keterangan && (
                              <p className="text-sm text-[var(--text-secondary)] mb-2">
                                {selected.keterangan}
                              </p>
                            )}
                            <p className="text-xs text-[var(--text-muted)]">
                              {doses.join(' • ')}
                            </p>
                          </>
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
                Dokter <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="form-input"
                disabled={loading}
              >
                <option value="">Pilih dokter...</option>
                {doctors.map((doctor) => (
                  <option key={doctor.userId} value={doctor.userId}>
                    {doctor.fullName} ({doctor.staffCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Nurse Selection */}
            <div className="form-group">
              <label className="form-label">
                Nakes <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedNurseId}
                onChange={(e) => setSelectedNurseId(e.target.value)}
                className="form-input"
                disabled={loading}
              >
                <option value="">Pilih nakes...</option>
                {nurses.map((nurse) => (
                  <option key={nurse.userId} value={nurse.userId}>
                    {nurse.fullName} ({nurse.staffCode})
                  </option>
                ))}
              </select>
            </div>

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
          </div>
        </form>

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
