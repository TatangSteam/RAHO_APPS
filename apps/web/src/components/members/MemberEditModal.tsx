'use client';

import { useState, useEffect, useRef } from 'react';
import { X, User, Mail, Phone, MapPin, Calendar, Save, Loader2, Tag, Heart, DollarSign } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { createMemberApi, updateMemberApi } from '@/lib/membersApi';
import { getActiveReferrals } from '@/lib/api/referralsApi';
import { devLog, devError } from '@/lib/logger';

interface MemberEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'create' | 'edit';
  branchId: string;
  memberId?: string;
  memberData?: any;
  userRole?: string;
}

interface MemberFormData {
  fullName: string;
  memberUsername: string;
  memberPassword: string;
  phone: string;
  email?: string;
  address?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: 'L' | 'P';
  emergencyContact?: string;
  emergencyContactPhone?: string;
  referralCodeId?: string;
  isConsentToPhoto: boolean;
  firstIncentiveType?: 'PERCENTAGE' | 'FIXED_AMOUNT' | '';
  firstIncentiveValue?: number;
  nextIncentiveType?: 'PERCENTAGE' | 'FIXED_AMOUNT' | '';
  nextIncentiveValue?: number;
}

export default function MemberEditModal({
  isOpen,
  onClose,
  onSuccess,
  action,
  branchId,
  memberId,
  memberData,
  userRole
}: MemberEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [referralCodes, setReferralCodes] = useState<any[]>([]);
  const [filteredReferralCodes, setFilteredReferralCodes] = useState<any[]>([]);
  const [referralSearch, setReferralSearch] = useState('');
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState<MemberFormData>({
    fullName: '',
    memberUsername: '',
    memberPassword: '',
    phone: '',
    email: '',
    address: '',
    birthPlace: '',
    birthDate: '',
    gender: 'L',
    emergencyContact: '',
    emergencyContactPhone: '',
    referralCodeId: '',
    isConsentToPhoto: false,
    firstIncentiveType: '',
    firstIncentiveValue: 0,
    nextIncentiveType: '',
    nextIncentiveValue: 0
  });

  // Fetch referral codes
  useEffect(() => {
    const fetchReferralCodes = async () => {
      try {
        const response = await getActiveReferrals(branchId);
        setReferralCodes(response.data.data);
        setFilteredReferralCodes(response.data.data);
      } catch (error) {
        devError('Error fetching referral codes:', error);
      }
    };

    if (isOpen) {
      fetchReferralCodes();
    }
  }, [isOpen, branchId]);

  // Filter referral codes
  useEffect(() => {
    if (referralSearch.trim() === '') {
      setFilteredReferralCodes(referralCodes);
    } else {
      const searchLower = referralSearch.toLowerCase();
      const filtered = referralCodes.filter((ref) => 
        ref.code.toLowerCase().includes(searchLower) ||
        ref.referrerName.toLowerCase().includes(searchLower) ||
        ref.referrerType.toLowerCase().includes(searchLower)
      );
      setFilteredReferralCodes(filtered);
    }
  }, [referralSearch, referralCodes]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowReferralDropdown(false);
      }
    };

    if (showReferralDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReferralDropdown]);

  // Load member data for edit
  useEffect(() => {
    if (action === 'edit' && memberData) {
      devLog('Setting form data from memberData:', memberData);
      devLog('Phone debug:', {
        'memberData.user?.phone': memberData.user?.phone,
        'memberData.phone': memberData.phone,
        'memberData.profile?.phone': memberData.profile?.phone,
      });
      setFormData({
        fullName: memberData.profile?.fullName || memberData.fullName || '',
        memberUsername: memberData.user?.username || memberData.username || memberData.user?.email || memberData.email || '',
        memberPassword: '',
        phone: memberData.user?.phone || memberData.phone || memberData.profile?.phone || '',
        email: memberData.user?.email || memberData.email || '',
        address: memberData.profile?.address || memberData.address || '',
        birthPlace: memberData.profile?.birthPlace || memberData.tempatLahir || '',
        birthDate: memberData.profile?.birthDate ? memberData.profile.birthDate.split('T')[0] : 
                   memberData.dateOfBirth ? memberData.dateOfBirth.split('T')[0] : '',
        gender: memberData.profile?.gender || memberData.jenisKelamin || 'L',
        emergencyContact: memberData.profile?.emergencyContact || memberData.emergencyContact || '',
        emergencyContactPhone: memberData.profile?.emergencyContactPhone || memberData.emergencyContactPhone || '',
        referralCodeId: memberData.referralCodeId || '',
        isConsentToPhoto: memberData.profile?.isConsentToPhoto ?? memberData.isConsentToPhoto ?? false,
        firstIncentiveType: memberData.firstIncentiveType || '',
        firstIncentiveValue: memberData.firstIncentiveValue || 0,
        nextIncentiveType: memberData.nextIncentiveType || '',
        nextIncentiveValue: memberData.nextIncentiveValue || 0
      });
      
    } else if (action === 'create') {
      // Reset form
      setFormData({
        fullName: '',
        memberUsername: '',
        memberPassword: '',
        phone: '',
        email: '',
        address: '',
        birthPlace: '',
        birthDate: '',
        gender: 'L',
        emergencyContact: '',
        emergencyContactPhone: '',
        referralCodeId: '',
        isConsentToPhoto: false,
        firstIncentiveType: '',
        firstIncentiveValue: 0,
        nextIncentiveType: '',
        nextIncentiveValue: 0
      });
      setReferralSearch('');
    }
  }, [action, memberData]);

  useEffect(() => {
    if (action !== 'edit' || !memberData?.referralCodeId) return;

    const referral = referralCodes.find(ref => ref.id === memberData.referralCodeId);
    if (referral) {
      setReferralSearch(`${referral.code} - ${referral.referrerName}`);
    }
  }, [action, memberData?.referralCodeId, referralCodes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleReferralSelect = (referralId: string) => {
    setFormData(prev => ({ ...prev, referralCodeId: referralId }));
    const selected = referralCodes.find(ref => ref.id === referralId);
    if (selected) {
      setReferralSearch(`${selected.code} - ${selected.referrerName}`);
    } else {
      setReferralSearch('');
    }
    setShowReferralDropdown(false);
  };

  const handleReferralSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReferralSearch(e.target.value);
    setShowReferralDropdown(true);
    if (formData.referralCodeId) {
      setFormData(prev => ({ ...prev, referralCodeId: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.phone.trim() && formData.phone.replace(/\D/g, '').length < 10) {
      showToast.error('Nomor telepon minimal 10 digit');
      return;
    }

    setLoading(true);

    try {
      if (action === 'create') {
        const createData: any = {
          branchId: branchId,
          fullName: formData.fullName,
          memberUsername: formData.memberUsername,
          memberPassword: formData.memberPassword,
          isConsentToPhoto: formData.isConsentToPhoto,
        };

        if (formData.phone) createData.phone = formData.phone;
        if (formData.email) createData.email = formData.email;
        if (formData.address) createData.address = formData.address;
        if (formData.birthPlace) createData.birthPlace = formData.birthPlace;
        if (formData.birthDate) createData.birthDate = formData.birthDate;
        if (formData.gender) createData.gender = formData.gender;
        if (formData.emergencyContact) createData.emergencyContact = formData.emergencyContact;
        if (formData.emergencyContactPhone) createData.emergencyContactPhone = formData.emergencyContactPhone;
        if (formData.referralCodeId) createData.referralCodeId = formData.referralCodeId;
        if (formData.firstIncentiveType) {
          createData.firstIncentiveType = formData.firstIncentiveType;
          createData.firstIncentiveValue = formData.firstIncentiveValue;
        }
        if (formData.nextIncentiveType) {
          createData.nextIncentiveType = formData.nextIncentiveType; 
          createData.nextIncentiveValue = formData.nextIncentiveValue;
        }

        await createMemberApi(createData, {});
        showToast.success('Member berhasil ditambahkan');
      } else if (action === 'edit' && memberData) {
        const updateData: any = {
          fullName: formData.fullName,
          isConsentToPhoto: formData.isConsentToPhoto,
        };

        updateData.phone = formData.phone;
        if (formData.memberPassword) updateData.memberPassword = formData.memberPassword;
        updateData.username = formData.memberUsername;
        if (formData.address) updateData.address = formData.address;
        if (formData.birthPlace) updateData.birthPlace = formData.birthPlace;
        if (formData.birthDate) updateData.birthDate = formData.birthDate;
        if (formData.gender) updateData.gender = formData.gender;
        if (formData.emergencyContact) updateData.emergencyContact = formData.emergencyContact;
        if (formData.emergencyContactPhone) updateData.emergencyContactPhone = formData.emergencyContactPhone;
        if (formData.referralCodeId) updateData.referralCodeId = formData.referralCodeId;
        if (formData.firstIncentiveType) {
          updateData.firstIncentiveType = formData.firstIncentiveType;
          updateData.firstIncentiveValue = formData.firstIncentiveValue;
        }
        if (formData.nextIncentiveType) {
          updateData.nextIncentiveType = formData.nextIncentiveType;
          updateData.nextIncentiveValue = formData.nextIncentiveValue;
        }

        await updateMemberApi(memberId!, updateData);
        showToast.success('Member berhasil diupdate');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      devError('Submit error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menyimpan data member');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {action === 'create' ? 'Tambah Member Baru' : 'Edit Data Member'}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {action === 'create' ? 'Lengkapi formulir untuk menambah member' : 'Perbarui informasi member'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

        {/* Form Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
                <User className="w-4 h-4" />
                Informasi Dasar
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    Username Member {action === 'create' && <span className="text-red-500">*</span>}
                    {userRole === 'SUPER_ADMIN' && action === 'edit' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30 rounded-full">
                        <Mail className="w-3 h-3" />
                        EDITABLE
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="memberUsername"
                    value={formData.memberUsername}
                    onChange={handleInputChange}
                    required={action === 'create'}
                    className={`w-full px-4 py-3 text-sm rounded-xl border ${
                      userRole === 'SUPER_ADMIN' && action === 'edit'
                        ? 'border-blue-400 dark:border-blue-600/60 bg-blue-50/50 dark:bg-blue-500/5 focus:ring-blue-500 dark:focus:ring-blue-500/50 focus:border-blue-500 shadow-sm shadow-blue-200/50 dark:shadow-blue-500/10'
                        : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:ring-amber-500 focus:border-transparent'
                    } text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 transition-all`}
                    placeholder="contoh: budi.santoso"
                    minLength={4}
                    maxLength={30}
                    pattern="[A-Za-z0-9._-]+"
                  />
                  {userRole === 'SUPER_ADMIN' && action === 'edit' && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <span className="font-medium">ℹ️ Super Admin:</span> Anda dapat mengedit username member ini
                    </p>
                  )}
                </div>

                {action === 'create' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="memberPassword"
                      value={formData.memberPassword}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                      placeholder="Minimal 6 karakter"
                    />
                  </div>
                )}

                {action === 'edit' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                      Password Baru (Opsional)
                    </label>
                    <input
                      type="password"
                      name="memberPassword"
                      value={formData.memberPassword}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                      placeholder="Kosongkan jika tidak ingin mengubah"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    No. Telepon
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Opsional"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Jenis Kelamin
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Tempat Lahir
                  </label>
                  <input
                    type="text"
                    name="birthPlace"
                    value={formData.birthPlace}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Kota kelahiran"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Alamat
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                    placeholder="Alamat lengkap"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
                <Phone className="w-4 h-4" />
                Kontak Darurat
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Nama Kontak Darurat
                  </label>
                  <input
                    type="text"
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Nama keluarga/kerabat"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    No. Telepon Kontak Darurat
                  </label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>
            </div>

            {/* Referral Code */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
                <Tag className="w-4 h-4" />
                Kode Referral (Opsional)
              </h3>
              <div className="relative space-y-2" ref={dropdownRef}>
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Cari Kode Referral
                </label>
                <input
                  type="text"
                  value={referralSearch}
                  onChange={handleReferralSearchChange}
                  onFocus={() => setShowReferralDropdown(true)}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  placeholder="Ketik untuk mencari kode referral..."
                />
                
                {showReferralDropdown && filteredReferralCodes.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filteredReferralCodes.map((ref) => (
                      <button
                        key={ref.id}
                        type="button"
                        onClick={() => handleReferralSelect(ref.id)}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-amber-50 dark:hover:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0"
                      >
                        <div className="font-medium text-neutral-900 dark:text-white">{ref.code}</div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {ref.referrerName} • {ref.referrerType}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Incentives */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
                <DollarSign className="w-4 h-4" />
                Insentif (Opsional)
              </h3>
              
              <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <h4 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Insentif Pembelian Pertama</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Tipe Insentif</label>
                    <select
                      name="firstIncentiveType"
                      value={formData.firstIncentiveType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    >
                      <option value="">Tidak ada insentif</option>
                      <option value="PERCENTAGE">Persentase (%)</option>
                      <option value="FIXED_AMOUNT">Nominal Tetap (Rp)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Nilai Insentif</label>
                    <input
                      type="number"
                      name="firstIncentiveValue"
                      value={formData.firstIncentiveValue}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      disabled={!formData.firstIncentiveType}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-neutral-100 dark:disabled:bg-neutral-700"
                      placeholder={formData.firstIncentiveType === 'PERCENTAGE' ? 'Contoh: 10 untuk 10%' : 'Nominal dalam rupiah'}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
                <h4 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Insentif Pembelian Berikutnya</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Tipe Insentif</label>
                    <select
                      name="nextIncentiveType"
                      value={formData.nextIncentiveType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    >
                      <option value="">Tidak ada insentif</option>
                      <option value="PERCENTAGE">Persentase (%)</option>
                      <option value="FIXED_AMOUNT">Nominal Tetap (Rp)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Nilai Insentif</label>
                    <input
                      type="number"
                      name="nextIncentiveValue"
                      value={formData.nextIncentiveValue}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      disabled={!formData.nextIncentiveType}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-neutral-100 dark:disabled:bg-neutral-700"
                      placeholder={formData.nextIncentiveType === 'PERCENTAGE' ? 'Contoh: 5 untuk 5%' : 'Nominal dalam rupiah'}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Consent */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
                <Heart className="w-4 h-4" />
                Persetujuan
              </h3>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isConsentToPhoto"
                    checked={formData.isConsentToPhoto}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-amber-500 border-neutral-300 dark:border-neutral-600 rounded focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    Member menyetujui untuk difoto selama sesi terapi
                  </span>
                </label>
              </div>
            </div>

          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-600 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white transition-all bg-amber-500 hover:bg-amber-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{action === 'create' ? 'Tambah Member' : 'Simpan Perubahan'}</span>
              </>
            )}
          </button>
        </div>

        </div>
      </div>
    </div>
  );
}
