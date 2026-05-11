'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createMemberApi } from '@/lib/membersApi';
import type { CreateMemberData } from '@/types/member';
import { showToast } from '@/lib/toast';
import NewMemberHeader from '@/components/members/new/NewMemberHeader';
import PersonalDataSection from '@/components/members/new/PersonalDataSection';
import AccountSection from '@/components/members/new/AccountSection';
import IncentiveSection from '@/components/members/new/IncentiveSection';
import DocumentUploadSection from '@/components/members/new/DocumentUploadSection';
import TherapyPlanSection, { type TherapyPlanData } from '@/components/members/new/TherapyPlanSection';

export default function NewMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [pspFile, setPspFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateMemberData>({
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
