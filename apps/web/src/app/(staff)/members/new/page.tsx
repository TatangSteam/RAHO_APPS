'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createMemberApi } from '@/lib/membersApi';
import type { CreateMemberData } from '@/types/member';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { branchesApi } from '@/lib/api/branchesApi';
import NewMemberHeader from '@/components/members/new/NewMemberHeader';
import PersonalDataSection from '@/components/members/new/PersonalDataSection';
import AccountSection from '@/components/members/new/AccountSection';
import IncentiveSection from '@/components/members/new/IncentiveSection';
import DocumentUploadSection from '@/components/members/new/DocumentUploadSection';
import TherapyPlanSection, { type TherapyPlanData } from '@/components/members/new/TherapyPlanSection';

interface Branch {
  id: string;
  name: string;
  branchCode: string;
}

export default function NewMemberPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [pspFile, setPspFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Branch selection for ADMIN_MANAGER
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const isAdminManager = user?.role === 'ADMIN_MANAGER';

  const [formData, setFormData] = useState<CreateMemberData>({
    // Branch selection (for ADMIN_MANAGER)
    branchId: '',
    
    // Section A - Data Pribadi
    fullName: '',
    nik: '',
    birthPlace: '',
    birthDate: '',
    gender: undefined,
    phone: '',
    email: '',
    address: '',
    occupation: '',
    maritalStatus: '',
    emergencyContact: '',
    emergencyContactPhone: '',
    infoSource: '',
    postalCode: '',
    
    // Section B - Akun Member
    memberEmail: '',
    memberPassword: '',
    referralCode: '',
    referralCodeId: '',
    isConsentToPhoto: true,
    
    // Section C - Pengaturan Insentif
    firstIncentiveType: undefined,
    firstIncentiveValue: undefined,
    nextIncentiveType: undefined,
    nextIncentiveValue: undefined,
  });

  const [therapyPlan, setTherapyPlan] = useState<TherapyPlanData[]>([]);

  // Fetch branches for ADMIN_MANAGER
  useEffect(() => {
    if (isAdminManager) {
      setLoadingBranches(true);
      branchesApi.getAllBranches()
        .then((response) => {
          const branchList = response.data?.data || [];
          setBranches(branchList);
          // Auto-select first branch if only one
          if (branchList.length === 1) {
            setFormData(prev => ({ ...prev, branchId: branchList[0].id }));
          }
        })
        .catch((err) => {
          console.error('Failed to fetch branches:', err);
          showToast.error('Gagal memuat daftar cabang');
        })
        .finally(() => {
          setLoadingBranches(false);
        });
    }
  }, [isAdminManager]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === 'firstIncentiveValue' || name === 'nextIncentiveValue') {
      // Convert to number for incentive values
      const numValue = value === '' ? undefined : parseFloat(value);
      setFormData((prev) => ({ ...prev, [name]: numValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleTherapyPlanChange = (plans: TherapyPlanData[]) => {
    setTherapyPlan(plans);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast.error('Ukuran foto maksimal 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePspChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast.error('Ukuran file PSP maksimal 5MB');
        return;
      }
      setPspFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setReferralError('');

    // Validation for ADMIN_MANAGER - must select branch
    if (isAdminManager && !formData.branchId) {
      showToast.error('Pilih cabang terlebih dahulu');
      return;
    }

    // Validation
    if (!formData.fullName || formData.fullName.length < 3) {
      showToast.error('Nama lengkap minimal 3 karakter');
      return;
    }
    if (!formData.phone || formData.phone.length < 10) {
      showToast.error('Nomor telepon minimal 10 digit');
      return;
    }
    if (!formData.memberEmail) {
      showToast.error('Email member wajib diisi');
      return;
    }
    if (!formData.memberPassword || formData.memberPassword.length < 8) {
      showToast.error('Password minimal 8 karakter');
      return;
    }

    try {
      setLoading(true);
      
      // Prepare data with therapy plans if any exist
      const dataToSubmit = {
        ...formData,
        // Only include branchId for ADMIN_MANAGER
        branchId: isAdminManager ? formData.branchId : undefined,
        therapyPlans: therapyPlan.length > 0 ? therapyPlan : undefined,
      };

      const result = await createMemberApi(dataToSubmit, {
        psp: pspFile || undefined,
        photo: photoFile || undefined,
      });

      showToast.success(`Member berhasil didaftarkan! No. Member: ${result.memberNo}`);
      router.push(`/members/${result.memberId}`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Gagal mendaftarkan member';
      const errorCode = err.response?.data?.error?.code;
      
      // Check if it's a referral code error
      if (errorCode === 'INVALID_REFERRAL_CODE') {
        setReferralError(errorMessage);
        showToast.error(errorMessage);
      } else {
        showToast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NewMemberHeader onBack={() => router.back()} />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Branch Selection for ADMIN_MANAGER */}
        {isAdminManager && (
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
              🏢 Pilih Cabang
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="branchId" style={{ fontSize: '14px', fontWeight: '500' }}>
                Cabang Pendaftaran <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="branchId"
                name="branchId"
                value={formData.branchId || ''}
                onChange={handleInputChange}
                disabled={loadingBranches}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  fontSize: '14px',
                  backgroundColor: '#1e293b',
                  color: '#f1f5f9',
                  cursor: loadingBranches ? 'not-allowed' : 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '36px',
                }}
                required
              >
                <option value="" style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
                  {loadingBranches ? 'Memuat cabang...' : '-- Pilih Cabang --'}
                </option>
                {branches.map((branch) => (
                  <option 
                    key={branch.id} 
                    value={branch.id}
                    style={{ backgroundColor: '#1e293b', color: '#f1f5f9' }}
                  >
                    {branch.name} ({branch.branchCode})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Member akan didaftarkan di cabang yang dipilih
              </p>
            </div>
          </div>
        )}

        <PersonalDataSection formData={formData} onChange={handleInputChange} />
        
        <AccountSection 
          formData={formData} 
          onChange={handleInputChange}
          referralError={referralError}
          onReferralErrorChange={setReferralError}
        />
        
        <IncentiveSection 
          formData={formData} 
          onChange={handleInputChange}
          showIncentiveSettings={!!formData.referralCodeId}
        />
        
        <DocumentUploadSection
          pspFile={pspFile}
          photoFile={photoFile}
          photoPreview={photoPreview}
          onPspChange={handlePspChange}
          onPhotoChange={handlePhotoChange}
        />

        <TherapyPlanSection
          therapyPlans={therapyPlan}
          onChange={handleTherapyPlanChange}
        />

        {/* Submit Buttons */}
        <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
            style={{ minWidth: '120px' }}
          >
            ❌ Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ flex: 1, minHeight: '48px', fontSize: '16px', fontWeight: '600' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                Mendaftarkan Member...
              </span>
            ) : (
              '✅ Daftarkan Member'
            )}
          </button>
        </div>
      </form>
    </>
  );
}
