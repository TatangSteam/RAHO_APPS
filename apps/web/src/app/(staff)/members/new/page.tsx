'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createMemberApi } from '@/lib/membersApi';
import type { CreateMemberData } from '@/types/member';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { branchesApi } from '@/lib/api/branchesApi';
import { devError } from '@/lib/logger';
import NewMemberHeader from '@/components/members/new/NewMemberHeader';
import PersonalDataSection from '@/components/members/new/PersonalDataSection';
import AccountSection from '@/components/members/new/AccountSection';
import IncentiveSection from '@/components/members/new/IncentiveSection';
import DocumentUploadSection from '@/components/members/new/DocumentUploadSection';
import { ErrorAlert } from '@/components/ui/Alert';
import { Building2, Loader2, Save, Trash2, X } from 'lucide-react';
import styles from './page.module.css';

interface Branch {
  id: string;
  name: string;
  branchCode: string;
}

interface FormFieldErrors {
  memberUsername?: string;
  fullName?: string;
  nik?: string;
  birthDate?: string;
}

const DUPLICATE_USERNAME_MESSAGE = 'Username sudah digunakan. Gunakan username lain untuk akun member.';

export default function NewMemberPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const requestedBranchId = searchParams.get('branchId') || '';
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : null;
  const canCreateMember = !!user && ['SUPER_ADMIN', 'ADMIN_CABANG', 'ADMIN_LAYANAN'].includes(user.role);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [referralError, setReferralError] = useState('');
  const [pspFile, setPspFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Branch selection for roles that are not attached to one branch account.
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const requiresBranchSelection = user?.role === 'SUPER_ADMIN';
  const isBranchLocked =
    requiresBranchSelection &&
    !!requestedBranchId &&
    branches.some((branch) => branch.id === requestedBranchId);

  const [formData, setFormData] = useState<CreateMemberData>({
    // Branch selection (for SUPER_ADMIN)
    branchId: requestedBranchId,
    
    // Section A - Data Pribadi
    fullName: '',
    identityType: 'NIK',
    nik: '',
    birthPlace: '',
    birthDate: '',
    gender: undefined,
    religion: '',
    phone: '',
    email: '',
    address: '',
    occupation: '',
    maritalStatus: '',
    emergencyContact: '',
    emergencyContactPhone: '',
    infoSource: '',
    postalCode: '',
    isDeceased: false,
    
    // Section B - Akun Member
    memberUsername: '',
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

  useEffect(() => {
    if (user && !canCreateMember) {
      showToast.error('Admin Manager hanya memiliki akses view member');
      router.replace('/members');
    }
  }, [canCreateMember, router, user]);

  // Form persistence - Save to localStorage
  const FORM_STORAGE_KEY = requestedBranchId
    ? `newMemberFormData:${requestedBranchId}`
    : 'newMemberFormData';
  
  // Load saved form data on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(FORM_STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        const savedFormData = parsed.formData;
        if (!savedFormData) return;

        setFormData({
          ...savedFormData,
          memberUsername: savedFormData.memberUsername || savedFormData.memberEmail || '',
          branchId: requestedBranchId || savedFormData.branchId || '',
          isDeceased: savedFormData.isDeceased === true || savedFormData.isDeceased === 'true',
        });
        // Note: Files cannot be saved to localStorage, user will need to re-upload
      }
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading saved form data:', error);
    }
  }, [FORM_STORAGE_KEY, requestedBranchId]);

  // Auto-save form data on change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const dataToSave = {
          formData,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (error) {
      assertCaughtError(error);
        devError('Error saving form data:', error);
      }
    }, 1000); // Save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [formData, FORM_STORAGE_KEY]);

  // Clear saved form data after successful submission
  const clearSavedFormData = () => {
    try {
      localStorage.removeItem(FORM_STORAGE_KEY);
    } catch (error) {
      assertCaughtError(error);
      devError('Error clearing saved form data:', error);
    }
  };

  // Fetch branches for SUPER_ADMIN.
  useEffect(() => {
    if (requiresBranchSelection) {
      setLoadingBranches(true);
      branchesApi.getAllBranches()
        .then((response) => {
          const branchList: Branch[] = response.data?.data || [];
          setBranches(branchList);

          if (requestedBranchId) {
            const requestedBranchExists = branchList.some(
              (branch) => branch.id === requestedBranchId
            );

            if (!requestedBranchExists) {
              showToast.error('Cabang tujuan tidak ditemukan atau tidak dapat diakses');
              setFormData((prev) => ({ ...prev, branchId: '' }));
              return;
            }

            setFormData((prev) => ({ ...prev, branchId: requestedBranchId }));
          } else if (branchList.length === 1) {
            setFormData((prev) => ({ ...prev, branchId: branchList[0].id }));
          }
        })
        .catch((err) => {
          devError('Failed to fetch branches:', err);
          showToast.error('Gagal memuat daftar cabang');
        })
        .finally(() => {
          setLoadingBranches(false);
        });
    }
  }, [requiresBranchSelection, requestedBranchId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (name === 'memberUsername' || name === 'fullName' || name === 'nik' || name === 'birthDate') {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    if (name === 'identityType') {
      setFieldErrors((prev) => ({ ...prev, nik: undefined }));
    }

    if (name === 'memberUsername') {
      if (formError.toLowerCase().includes('username')) {
        setFormError('');
      }
    }

    if (
      (name === 'fullName' || name === 'birthDate') &&
      formError.toLowerCase().includes('nama dan tanggal lahir')
    ) {
      setFormError('');
    }

    if ((name === 'nik' || name === 'identityType') && /nik|nomor identitas/i.test(formError)) {
      setFormError('');
    }
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === 'identityType') {
      const autoIdentityTypes = ['VIP', 'SPECIAL', 'FOREIGN_AUTO', 'NO_NIK'];
      setFormData((prev) => ({
        ...prev,
        identityType: value as CreateMemberData['identityType'],
        nik: autoIdentityTypes.includes(value) ? '' : prev.nik,
      }));
    } else if (name === 'isDeceased') {
      setFormData((prev) => ({ ...prev, isDeceased: value === 'true' }));
    } else if (name === 'firstIncentiveValue' || name === 'nextIncentiveValue') {
      // Convert to number for incentive values
      const numValue = value === '' ? undefined : parseFloat(value);
      setFormData((prev) => ({ ...prev, [name]: numValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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
    // Handle delete case - when files is null or empty
    if (!e.target.files || e.target.files.length === 0) {
      setPspFile(null);
      return;
    }
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
    setFormError('');
    setFieldErrors({});

    // SUPER_ADMIN must select the registration branch.
    if (requiresBranchSelection && !formData.branchId) {
      showToast.error('Pilih cabang terlebih dahulu');
      return;
    }

    // Validation for required personal data fields
    if (!formData.fullName || formData.fullName.length < 3) {
      showToast.error('Nama lengkap minimal 3 karakter');
      return;
    }
    const identityType = formData.identityType || 'NIK';
    const autoIdentityTypes = ['VIP', 'SPECIAL', 'FOREIGN_AUTO', 'NO_NIK'];
    const needsManualIdentity = !autoIdentityTypes.includes(identityType);

    if (needsManualIdentity && !formData.nik?.trim()) {
      showToast.error(identityType === 'NIK' ? 'NIK wajib diisi' : 'Nomor identitas wajib diisi');
      return;
    }
    if (identityType === 'NIK' && !/^\d{16}$/.test(formData.nik || '')) {
      showToast.error('NIK harus 16 digit');
      return;
    }
    if (formData.phone?.trim() && formData.phone.replace(/\D/g, '').length < 10) {
      showToast.error('Nomor telepon minimal 10 digit');
      return;
    }
    if (!formData.birthDate) {
      showToast.error('Tanggal lahir wajib diisi');
      return;
    }
    if (!formData.gender) {
      showToast.error('Jenis kelamin wajib dipilih');
      return;
    }
    if (!formData.address) {
      showToast.error('Alamat wajib diisi');
      return;
    }
    
    // Validation for account section
    if (!formData.memberUsername) {
      showToast.error('Username member wajib diisi');
      return;
    }
    if (!/^[a-zA-Z0-9._-]{4,30}$/.test(formData.memberUsername)) {
      const usernameError = 'Username harus 4-30 karakter dan hanya boleh berisi huruf, angka, titik, _ atau -';
      setFormError(usernameError);
      setFieldErrors((current) => ({ ...current, memberUsername: usernameError }));
      showToast.error(usernameError);
      return;
    }
    if (!formData.memberPassword || formData.memberPassword.length < 8) {
      showToast.error('Password minimal 8 karakter');
      return;
    }

    try {
      setLoading(true);
      
      // Prepare data without therapy plans
      const dataToSubmit = {
        ...formData,
        phone: formData.phone?.trim() || undefined,
        // Only roles without a fixed branch send an explicit target branch.
        branchId: requiresBranchSelection ? formData.branchId : undefined,
      };

      const result = await createMemberApi(dataToSubmit, {
        psp: pspFile || undefined,
        photo: photoFile || undefined,
      });

      showToast.success(`Member berhasil didaftarkan! No. Member: ${result.memberNo}`);
      
      // Clear saved form data after successful submission
      clearSavedFormData();
      
      router.push(`/members/${result.memberId}`);
    } catch (err) {
      assertCaughtError(err);
      const errorMessage = err.response?.data?.error?.message || 'Gagal mendaftarkan member';
      const errorCode = err.response?.data?.error?.code;
      const status = err.response?.status;
      
      // Check if it's a referral code error
      if (errorCode === 'INVALID_REFERRAL_CODE') {
        setReferralError(errorMessage);
        showToast.error(errorMessage);
      } else if (errorCode === 'USERNAME_EXISTS' || (status === 409 && /username/i.test(errorMessage))) {
        setFormError(DUPLICATE_USERNAME_MESSAGE);
        setFieldErrors({ memberUsername: DUPLICATE_USERNAME_MESSAGE });
        showToast.error(DUPLICATE_USERNAME_MESSAGE);
        requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('[name="memberUsername"]')?.focus();
        });
      } else if (errorCode === 'NIK_EXISTS' || errorCode === 'IDENTITY_EXISTS') {
        setFormError(errorMessage);
        setFieldErrors({ nik: errorMessage });
        showToast.error(errorMessage);
        requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('[name="nik"]')?.focus();
        });
      } else if (errorCode === 'MEMBER_NAME_BIRTH_DATE_EXISTS') {
        setFormError(errorMessage);
        setFieldErrors({ fullName: errorMessage, birthDate: errorMessage });
        showToast.error(errorMessage);
        requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('[name="fullName"]')?.focus();
        });
      } else {
        setFormError(errorMessage);
        showToast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearDraft = () => {
    if (confirm('Hapus semua data yang tersimpan? Data yang sudah diisi akan hilang.')) {
      clearSavedFormData();
      // Reset form to initial state
      setFormData({
        branchId: requestedBranchId,
        fullName: '',
        identityType: 'NIK',
        nik: '',
        birthPlace: '',
        birthDate: '',
        gender: undefined,
        religion: '',
        phone: '',
        email: '',
        address: '',
        occupation: '',
        maritalStatus: '',
        emergencyContact: '',
        emergencyContactPhone: '',
        infoSource: '',
        postalCode: '',
        isDeceased: false,
        memberUsername: '',
        memberPassword: '',
        referralCode: '',
        referralCodeId: '',
        isConsentToPhoto: true,
        firstIncentiveType: undefined,
        firstIncentiveValue: undefined,
        nextIncentiveType: undefined,
        nextIncentiveValue: undefined,
      });
      setPspFile(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      showToast.success('Draft berhasil dihapus');
    }
  };

  // Check if there's saved data
  const [hasSavedData, setHasSavedData] = useState(false);
  useEffect(() => {
    const savedData = localStorage.getItem(FORM_STORAGE_KEY);
    setHasSavedData(!!savedData);
  }, [formData, FORM_STORAGE_KEY]);

  if (user && !canCreateMember) {
    return null;
  }

  return (
    <main className={styles.page}>
      <NewMemberHeader onBack={() => returnTo ? router.push(returnTo) : router.back()} />

      {hasSavedData && (
        <div className={styles.draftNotice}>
          <div className={styles.draftCopy}>
            <Save size={19} />
            <div>
              <strong>Draft tersimpan otomatis</strong>
              <p>Anda dapat meninggalkan halaman ini dan melanjutkan pengisian nanti.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearDraft}
            className={styles.clearDraft}
          >
            <Trash2 size={14} />
            Hapus Draft
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {formError && (
          <ErrorAlert title="Error">
            {formError}
          </ErrorAlert>
        )}

        {/* Branch Selection for SUPER_ADMIN */}
        {requiresBranchSelection && (
          <section className={styles.branchCard}>
            <div className={styles.branchHeading}>
              <div><Building2 size={19} /></div>
              <div>
                <h2>Cabang Pendaftaran</h2>
                <p>Tentukan cabang yang bertanggung jawab atas data dan pelayanan awal member.</p>
              </div>
            </div>
            <div className={styles.branchField}>
              <label htmlFor="branchId">
                Pilih cabang <span className={styles.required}>*</span>
              </label>
              <select
                id="branchId"
                name="branchId"
                value={formData.branchId || ''}
                onChange={handleInputChange}
                disabled={loadingBranches || isBranchLocked}
                className="form-input"
                required
              >
                <option value="">
                  {loadingBranches ? 'Memuat cabang...' : '-- Pilih Cabang --'}
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.branchCode})
                  </option>
                ))}
              </select>
              <p>
                {isBranchLocked
                  ? 'Cabang dipilih otomatis dari halaman detail cabang'
                  : 'Member akan didaftarkan di cabang yang dipilih'}
              </p>
            </div>
          </section>
        )}

        <PersonalDataSection formData={formData} onChange={handleInputChange} errors={fieldErrors} />
        
        <AccountSection 
          formData={formData} 
          onChange={handleInputChange}
          referralError={referralError}
          onReferralErrorChange={setReferralError}
          errors={fieldErrors}
          branchId={requiresBranchSelection ? formData.branchId : undefined}
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

        {/* Submit Buttons */}
        <div className={styles.formActions}>
          <button
            type="button"
            onClick={() => returnTo ? router.push(returnTo) : router.back()}
            className={styles.cancelButton}
          >
            <X size={17} />
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Mendaftarkan Member...
              </>
            ) : (
              <>
                <Save size={18} />
                Daftarkan Member
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
