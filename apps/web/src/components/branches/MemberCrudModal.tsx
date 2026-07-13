'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Save, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/lib/toast';
import { createMemberApi, updateMemberApi } from '@/lib/membersApi';
import { getActiveReferrals } from '@/lib/api/referralsApi';
import { devLog, devError } from '@/lib/logger';
import { CrudModal } from './CrudModal';
import styles from '@/styles/crud-modal.module.css';

interface MemberCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'create' | 'edit' | 'delete';
  branchId: string;
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
  // Incentive fields
  firstIncentiveType?: 'PERCENTAGE' | 'FIXED_AMOUNT' | '';
  firstIncentiveValue?: number;
  nextIncentiveType?: 'PERCENTAGE' | 'FIXED_AMOUNT' | '';
  nextIncentiveValue?: number;
}

export default function MemberCrudModal({
  isOpen,
  onClose,
  onSuccess,
  action,
  branchId,
  memberData,
  userRole
}: MemberCrudModalProps) {
  const [loading, setLoading] = useState(false);
  const [referralCodes, setReferralCodes] = useState<any[]>([]);
  const [filteredReferralCodes, setFilteredReferralCodes] = useState<any[]>([]);
  const [referralSearch, setReferralSearch] = useState('');
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
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
    // Incentive fields
    firstIncentiveType: '',
    firstIncentiveValue: 0,
    nextIncentiveType: '',
    nextIncentiveValue: 0
  });

  // Fetch referral codes on mount
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

  // Filter referral codes based on search
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
      const target = event.target as HTMLElement;
      if (!target.closest('#referralSearch') && !target.closest(`.${styles.dropdownList}`)) {
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

  useEffect(() => {
    if (action === 'edit' && memberData) {
      devLog('🔍 [MemberCrudModal] Setting form data from memberData:', memberData);
      setFormData({
        fullName: memberData.fullName || '',
        memberUsername: memberData.username || memberData.email || '',
        memberPassword: '', // Don't populate password for edit
        phone: memberData.phone || '', // Phone is at top level
        email: memberData.contactEmail || '',
        address: memberData.address || '',
        birthPlace: memberData.tempatLahir || '',
        birthDate: memberData.dateOfBirth ? memberData.dateOfBirth.split('T')[0] : '',
        gender: memberData.jenisKelamin || 'L',
        emergencyContact: memberData.emergencyContact || '',
        emergencyContactPhone: memberData.emergencyContactPhone || '',
        referralCodeId: memberData.referralCodeId || '',
        isConsentToPhoto: memberData.isConsentToPhoto ?? false,
        // Incentive fields
        firstIncentiveType: memberData.firstIncentiveType || '',
        firstIncentiveValue: memberData.firstIncentiveValue || 0,
        nextIncentiveType: memberData.nextIncentiveType || '',
        nextIncentiveValue: memberData.nextIncentiveValue || 0
      });
      devLog('🔍 [MemberCrudModal] Form data set successfully');
    } else if (action === 'create') {
      // Reset form for create action
      setReferralSearch('');
      setShowReferralDropdown(false);
    }
  }, [action, memberData]);

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
    // Clear selection if user is typing
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

    devLog('🔍 [MemberCrudModal] Submit attempt:', { action, formData, branchId });

    try {
      if (action === 'create') {
        devLog('🔍 [MemberCrudModal] Creating member with data:', formData);
        
        // Prepare data - explicitly build the object to avoid spreading unwanted fields
        const createData: any = {
          fullName: formData.fullName,
          memberUsername: formData.memberUsername,
          memberPassword: formData.memberPassword,
          isConsentToPhoto: formData.isConsentToPhoto,
          branchId: branchId, // Include branchId for ADMIN_MANAGER
        };
        
        // Add optional fields only if they have values
        if (formData.phone) createData.phone = formData.phone;
        if (formData.email) createData.email = formData.email;
        if (formData.address) createData.address = formData.address;
        if (formData.birthPlace) createData.birthPlace = formData.birthPlace;
        if (formData.birthDate) createData.birthDate = formData.birthDate;
        if (formData.gender) createData.gender = formData.gender;
        if (formData.emergencyContact) createData.emergencyContact = formData.emergencyContact;
        if (formData.emergencyContactPhone) createData.emergencyContactPhone = formData.emergencyContactPhone;
        if (formData.referralCodeId) createData.referralCodeId = formData.referralCodeId;
        
        // Only include incentive fields if type is set (not empty string)
        if (formData.firstIncentiveType) {
          createData.firstIncentiveType = formData.firstIncentiveType;
          createData.firstIncentiveValue = formData.firstIncentiveValue || 0;
        }
        if (formData.nextIncentiveType) {
          createData.nextIncentiveType = formData.nextIncentiveType;
          createData.nextIncentiveValue = formData.nextIncentiveValue || 0;
        }
        
        devLog('🔍 [MemberCrudModal] Final createData:', createData);
        
        await createMemberApi(createData, {});
        showToast.success('Member berhasil ditambahkan');
      } else if (action === 'edit') {
        const updateData: any = {
          fullName: formData.fullName,
          phone: formData.phone,
          address: formData.address,
          birthDate: formData.birthDate,
          gender: formData.gender,
          emergencyContactName: formData.emergencyContact,
        };
        
        // Member login identifiers are stored in the existing User.email column.
        updateData.username = formData.memberUsername;
        
        // Include incentive fields in update
        if (formData.firstIncentiveType) {
          updateData.firstIncentiveType = formData.firstIncentiveType;
          updateData.firstIncentiveValue = formData.firstIncentiveValue;
        }
        if (formData.nextIncentiveType) {
          updateData.nextIncentiveType = formData.nextIncentiveType;
          updateData.nextIncentiveValue = formData.nextIncentiveValue;
        }
        
        devLog('🔍 [MemberCrudModal] Updating member:', memberData.memberId, 'with data:', updateData);
        await updateMemberApi(memberData.memberId, updateData);
        showToast.success('Member berhasil diperbarui');
      }
      
      onSuccess();
    } catch (error: any) {
      devError('❌ [MemberCrudModal] Error saving member:', error);
      devError('❌ [MemberCrudModal] Error response:', error.response?.data);
      devError('❌ [MemberCrudModal] Error status:', error.response?.status);
      showToast.error(error.response?.data?.message || `Gagal ${action === 'create' ? 'menambahkan' : 'memperbarui'} member`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <CrudModal
      icon={<User size={24} />}
      open={isOpen}
      title={action === 'create' ? 'Tambah Member Baru' : 'Edit Member'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="fullName">
                <User size={16} />
                Nama Lengkap *
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                required
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone">
                <Phone size={16} />
                Nomor Telepon
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Opsional"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="memberUsername" className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail size={16} />
                  Username Member *
                </span>
                {userRole === 'SUPER_ADMIN' && action === 'edit' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30 rounded-full">
                    <Mail size={12} />
                    EDITABLE
                  </span>
                )}
              </label>
              <input
                type="text"
                id="memberUsername"
                name="memberUsername"
                value={formData.memberUsername}
                onChange={handleInputChange}
                required
                disabled={action === 'edit' && userRole !== 'SUPER_ADMIN'}
                placeholder="contoh: budi.santoso"
                minLength={4}
                maxLength={30}
                pattern="[A-Za-z0-9._-]+"
                className={userRole === 'SUPER_ADMIN' && action === 'edit' 
                  ? 'border-blue-400 dark:border-blue-600/60 bg-blue-50/50 dark:bg-blue-500/5 focus:ring-blue-500 dark:focus:ring-blue-500/50 focus:border-blue-500 shadow-sm shadow-blue-200/50 dark:shadow-blue-500/10'
                  : ''}
              />
              {userRole === 'SUPER_ADMIN' && action === 'edit' && (
                <small className="block mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  ℹ️ Super Admin: Anda dapat mengedit username member ini
                </small>
              )}
            </div>

            {action === 'create' && (
              <div className={styles.formGroup}>
                <label htmlFor="memberPassword">
                  Password Member *
                </label>
                <input
                  type="password"
                  id="memberPassword"
                  name="memberPassword"
                  value={formData.memberPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="email">
                <Mail size={16} />
                Email Alternatif
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="email@example.com"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="birthDate">
                <Calendar size={16} />
                Tanggal Lahir
              </label>
              <input
                type="date"
                id="birthDate"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleInputChange}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="birthPlace">
                <MapPin size={16} />
                Tempat Lahir
              </label>
              <input
                type="text"
                id="birthPlace"
                name="birthPlace"
                value={formData.birthPlace}
                onChange={handleInputChange}
                placeholder="Kota tempat lahir"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="gender">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            {action === 'create' && (
              <div className={styles.formGroup} style={{ position: 'relative' }}>
                <label htmlFor="referralCodeId">
                  <Tag size={16} />
                  Kode Referral (Optional)
                </label>
                <input
                  type="text"
                  id="referralSearch"
                  name="referralSearch"
                  value={referralSearch}
                  onChange={handleReferralSearchChange}
                  onFocus={() => setShowReferralDropdown(true)}
                  placeholder="Ketik untuk mencari kode referral atau nama..."
                  autoComplete="off"
                />
                {showReferralDropdown && (
                  <div className={styles.dropdownList}>
                    <div 
                      className={styles.dropdownItem}
                      onClick={() => {
                        handleReferralSelect('');
                        setReferralSearch('');
                      }}
                    >
                      <div className={styles.dropdownItemContent}>
                        <span className={styles.dropdownCode}>-</span>
                        <span className={styles.dropdownName}>Tidak ada referral</span>
                      </div>
                    </div>
                    {filteredReferralCodes.length === 0 ? (
                      <div className={styles.dropdownEmpty}>
                        Tidak ada referral ditemukan
                      </div>
                    ) : (
                      filteredReferralCodes.map((ref) => (
                        <div
                          key={ref.id}
                          className={`${styles.dropdownItem} ${formData.referralCodeId === ref.id ? styles.dropdownItemSelected : ''}`}
                          onClick={() => handleReferralSelect(ref.id)}
                        >
                          <div className={styles.dropdownItemContent}>
                            <span className={styles.dropdownCode}>{ref.code}</span>
                            <span className={styles.dropdownName}>{ref.referrerName}</span>
                            <span className={styles.dropdownType}>{ref.referrerType}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={styles.formGroupFull}>
              <label htmlFor="address">
                <MapPin size={16} />
                Alamat Lengkap
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                placeholder="Alamat lengkap member"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="emergencyContact">
                Kontak Darurat
              </label>
              <input
                type="text"
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleInputChange}
                placeholder="Nama kontak darurat"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="emergencyContactPhone">
                Telepon Darurat
              </label>
              <input
                type="tel"
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={handleInputChange}
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </div>

          {/* Incentive Section - Only show when creating member with referral code */}
          {action === 'create' && formData.referralCodeId && (
            <>
              <div className={styles.sectionDivider}>
                <span className={styles.sectionTitle}>💰 Pengaturan Insentif Referral (Opsional)</span>
              </div>

              <div className={styles.infoBox}>
                <strong>ℹ️ Catatan:</strong> Insentif ditentukan per member. Setiap member dapat memiliki rate insentif yang berbeda meskipun menggunakan kode referral yang sama.
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="firstIncentiveType">
                    Insentif Paket Pertama - Tipe
                  </label>
                  <select
                    id="firstIncentiveType"
                    name="firstIncentiveType"
                    value={formData.firstIncentiveType}
                    onChange={handleInputChange}
                  >
                    <option value="">Tidak Ada Insentif</option>
                    <option value="PERCENTAGE">Persentase (%)</option>
                    <option value="FIXED_AMOUNT">Nominal (Rp)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="firstIncentiveValue">
                    Nilai Insentif Pertama
                  </label>
                  <input
                    type="number"
                    id="firstIncentiveValue"
                    name="firstIncentiveValue"
                    value={formData.firstIncentiveValue}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    disabled={!formData.firstIncentiveType}
                    placeholder={formData.firstIncentiveType === 'PERCENTAGE' ? 'Contoh: 10 (untuk 10%)' : 'Contoh: 500000'}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="nextIncentiveType">
                    Insentif Paket Lanjutan - Tipe
                  </label>
                  <select
                    id="nextIncentiveType"
                    name="nextIncentiveType"
                    value={formData.nextIncentiveType}
                    onChange={handleInputChange}
                  >
                    <option value="">Tidak Ada Insentif</option>
                    <option value="PERCENTAGE">Persentase (%)</option>
                    <option value="FIXED_AMOUNT">Nominal (Rp)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="nextIncentiveValue">
                    Nilai Insentif Lanjutan
                  </label>
                  <input
                    type="number"
                    id="nextIncentiveValue"
                    name="nextIncentiveValue"
                    value={formData.nextIncentiveValue}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    disabled={!formData.nextIncentiveType}
                    placeholder={formData.nextIncentiveType === 'PERCENTAGE' ? 'Contoh: 5 (untuk 5%)' : 'Contoh: 250000'}
                  />
                </div>
              </div>
            </>
          )}

          <div className={styles.formGrid}>
            <div className={styles.formGroupFull}>
              <div className={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  id="isConsentToPhoto"
                  name="isConsentToPhoto"
                  checked={formData.isConsentToPhoto}
                  onChange={handleInputChange}
                />
                <label htmlFor="isConsentToPhoto">Setuju untuk difoto</label>
              </div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <Button
              unstyled
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              unstyled
              type="submit"
              className={styles.saveButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {action === 'create' ? 'Tambah Member' : 'Simpan Perubahan'}
                </>
              )}
            </Button>
          </div>
      </form>
    </CrudModal>
  );
}
