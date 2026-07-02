'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { getActiveReferrals } from '@/lib/api/referralsApi';
import type { CreateMemberData } from '@/types/member';
import { devError } from '@/lib/logger';

interface AccountSectionProps {
  formData: CreateMemberData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  referralError?: string;
  onReferralErrorChange?: (error: string) => void;
  errors?: {
    memberEmail?: string;
  };
  branchId?: string; // Optional branchId to filter referrals
}

const invalidInputStyle: CSSProperties = {
  borderColor: '#ef4444',
  boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.35)',
};

const fieldHintStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
  marginTop: '6px',
};

const fieldErrorStyle: CSSProperties = {
  ...fieldHintStyle,
  color: '#ef4444',
  fontWeight: 600,
};

export default function AccountSection({ formData, onChange, referralError, onReferralErrorChange, errors, branchId }: AccountSectionProps) {
  const [referralCodes, setReferralCodes] = useState<any[]>([]);
  const [filteredReferralCodes, setFilteredReferralCodes] = useState<any[]>([]);
  const [referralSearch, setReferralSearch] = useState('');
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
  const [selectedReferralId, setSelectedReferralId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const memberEmailError = errors?.memberEmail;

  // Fetch referral codes on mount or when branchId changes
  useEffect(() => {
    const fetchReferralCodes = async () => {
      try {
        // Pass branchId to filter referrals by branch
        const response = await getActiveReferrals(branchId);
        setReferralCodes(response.data.data);
        setFilteredReferralCodes(response.data.data);
      } catch (error) {
        devError('Error fetching referral codes:', error);
      }
    };

    fetchReferralCodes();
  }, [branchId]);

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
      if (!target.closest('#referralSearchInput') && !target.closest('.referral-dropdown-list')) {
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

  const handleReferralSelect = (referralId: string, referralCode: string) => {
    setSelectedReferralId(referralId);
    const selected = referralCodes.find(ref => ref.id === referralId);
    if (selected) {
      setReferralSearch(`${selected.code} - ${selected.referrerName}`);
      // Clear error when valid selection is made
      if (onReferralErrorChange) {
        onReferralErrorChange('');
      }
      // Update parent form data with both referral code and ID
      const referralCodeEvent = {
        target: {
          name: 'referralCode',
          value: referralCode,
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralCodeEvent);
      
      // Also send the referralCodeId
      const referralIdEvent = {
        target: {
          name: 'referralCodeId',
          value: referralId,
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralIdEvent);
    } else {
      setReferralSearch('');
      // Clear error when cleared
      if (onReferralErrorChange) {
        onReferralErrorChange('');
      }
      const referralCodeEvent = {
        target: {
          name: 'referralCode',
          value: '',
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralCodeEvent);
      
      const referralIdEvent = {
        target: {
          name: 'referralCodeId',
          value: '',
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralIdEvent);
    }
    setShowReferralDropdown(false);
  };

  const handleReferralSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReferralSearch(e.target.value);
    setShowReferralDropdown(true);
    // Clear selection if user is typing
    if (selectedReferralId) {
      setSelectedReferralId('');
      const referralCodeEvent = {
        target: {
          name: 'referralCode',
          value: '',
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralCodeEvent);
      
      const referralIdEvent = {
        target: {
          name: 'referralCodeId',
          value: '',
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralIdEvent);
    }
  };

  const handleReferralBlur = () => {
    // When user leaves the input without selecting from dropdown
    // Check if they typed something that doesn't match a selection
    if (referralSearch.trim() && !selectedReferralId) {
      // User typed something but didn't select from dropdown
      // Send the typed value as referralCode so backend can validate it
      const referralCodeEvent = {
        target: {
          name: 'referralCode',
          value: referralSearch.trim(),
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralCodeEvent);
      
      // Clear referralCodeId since this is manual input
      const referralIdEvent = {
        target: {
          name: 'referralCodeId',
          value: '',
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralIdEvent);
    } else if (!referralSearch.trim()) {
      // User cleared the field - clear both values
      const referralCodeEvent = {
        target: {
          name: 'referralCode',
          value: '',
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralCodeEvent);
      
      const referralIdEvent = {
        target: {
          name: 'referralCodeId',
          value: '',
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(referralIdEvent);
    }
    // Close dropdown after a short delay to allow click events to fire
    setTimeout(() => setShowReferralDropdown(false), 200);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--surface-border)' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '18px'
        }}>
          B
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Akun Member</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div>
          <label className="form-label">
            Email Login <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="email"
            name="memberEmail"
            value={formData.memberEmail}
            onChange={onChange}
            required
            className="form-input"
            placeholder="email.member@example.com"
            autoComplete="off"
            aria-invalid={!!memberEmailError}
            aria-describedby={memberEmailError ? 'memberEmail-error' : undefined}
            style={memberEmailError ? invalidInputStyle : undefined}
          />
          {memberEmailError ? (
            <p id="memberEmail-error" role="alert" style={fieldErrorStyle}>
              {memberEmailError}
            </p>
          ) : (
            <p style={fieldHintStyle}>Email untuk login ke aplikasi member</p>
          )}
        </div>

        <div>
          <label className="form-label">
            Password <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="memberPassword"
              value={formData.memberPassword}
              onChange={onChange}
              required
              minLength={8}
              className="form-input"
              placeholder="Minimal 8 karakter"
              autoComplete="new-password"
              style={{ paddingRight: '45px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Minimal 8 karakter</p>
        </div>

        <div style={{ position: 'relative' }}>
          <label className="form-label">Kode Referral</label>
          <input
            type="text"
            id="referralSearchInput"
            name="referralSearch"
            value={referralSearch}
            onChange={handleReferralSearchChange}
            onFocus={() => setShowReferralDropdown(true)}
            onBlur={handleReferralBlur}
            className={`form-input ${referralError ? 'error' : ''}`}
            placeholder="Ketik untuk mencari kode referral atau nama..."
            autoComplete="off"
          />
          {referralError && (
            <p className="form-error" style={{ marginTop: '6px' }}>
              <span>⚠️</span>
              <span>{referralError}</span>
            </p>
          )}
          {showReferralDropdown && (
            <div className="referral-dropdown-list" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              maxHeight: '300px',
              overflowY: 'auto',
              background: 'var(--surface-card)',
              border: '2px solid var(--surface-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 1000,
            }}>
              <div 
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--surface-border)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleReferralSelect('', '');
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>-</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Tidak ada referral</span>
                </div>
              </div>
              {filteredReferralCodes.length === 0 ? (
                <div style={{
                  padding: '20px 16px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  fontStyle: 'italic',
                }}>
                  Tidak ada referral ditemukan
                </div>
              ) : (
                filteredReferralCodes.map((ref) => (
                  <div
                    key={ref.id}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--surface-border)',
                      transition: 'all 0.2s',
                      background: selectedReferralId === ref.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      borderLeft: selectedReferralId === ref.id ? '3px solid var(--color-primary-500)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedReferralId !== ref.id) {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedReferralId !== ref.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleReferralSelect(ref.id, ref.code);
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary-400)' }}>{ref.code}</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{ref.referrerName}</span>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{ref.referrerType}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
          <input
            type="checkbox"
            name="isConsentToPhoto"
            checked={formData.isConsentToPhoto}
            onChange={onChange}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
          <label style={{ marginLeft: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            📸 Setuju untuk difoto
          </label>
        </div>
      </div>
    </div>
  );
}
