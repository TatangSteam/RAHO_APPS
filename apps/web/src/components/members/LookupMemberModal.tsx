'use client';

import { useState, useEffect } from 'react';
import { lookupMemberApi, grantAccessApi } from '@/lib/membersApi';
import type { MemberLookup } from '@/types/member';

interface LookupMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LookupMemberModal({ isOpen, onClose, onSuccess }: LookupMemberModalProps) {
  const [lookupMemberNo, setLookupMemberNo] = useState('');
  const [lookupResult, setLookupResult] = useState<MemberLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [error, setError] = useState('');

  // Lock/unlock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleLookup = async () => {
    if (!lookupMemberNo) {
      setError('Nomor member wajib diisi');
      return;
    }

    try {
      setLookupLoading(true);
      setError('');
      const result = await lookupMemberApi(lookupMemberNo);
      setLookupResult(result);
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Member tidak ditemukan');
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!lookupResult) return;

    if (
      !confirm(
        `Berikan akses member ${lookupResult.fullName} (${lookupResult.memberNo}) ke cabang Anda?`
      )
    ) {
      return;
    }

    try {
      setGrantingAccess(true);
      setError('');
      await grantAccessApi(lookupResult.memberNo);
      alert('Akses berhasil diberikan!');
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Gagal memberikan akses');
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleClose = () => {
    setLookupMemberNo('');
    setLookupResult(null);
    setError('');
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        padding: '24px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        style={{ 
          width: '100%', 
          maxWidth: '550px', 
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          borderRadius: '20px',
          padding: '40px',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
            🔍 Cari Member Lintas Cabang
          </h3>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '32px',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '0',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '14px 18px',
            backgroundColor: '#fee2e2',
            border: '2px solid #fca5a5',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span style={{ color: '#dc2626', fontWeight: '600', fontSize: '14px' }}>{error}</span>
          </div>
        )}

        {/* Input */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '10px', 
            fontWeight: '700', 
            fontSize: '15px',
            color: '#374151'
          }}>
            Nomor Member
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="MBR-XXX-XXXX-XXXXX"
              value={lookupMemberNo}
              onChange={(e) => setLookupMemberNo(e.target.value.toUpperCase())}
              style={{ 
                flex: 1, 
                fontFamily: 'monospace', 
                backgroundColor: '#ffffff', 
                color: '#111827', 
                border: '3px solid #e5e7eb',
                borderRadius: '10px',
                padding: '14px 18px',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s',
                fontWeight: '600'
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
            <button
              onClick={handleLookup}
              disabled={lookupLoading}
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '15px',
                cursor: lookupLoading ? 'not-allowed' : 'pointer',
                opacity: lookupLoading ? 0.6 : 1,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!lookupLoading) e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              {lookupLoading ? '⏳ Mencari...' : '🔍 Cari'}
            </button>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '10px', margin: '10px 0 0 0' }}>
            💡 Contoh: MBR-PST-2604-00043
          </p>
        </div>

        {/* Loading */}
        {lookupLoading && (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="spinner" style={{ width: '56px', height: '56px', margin: '0 auto 20px' }}></div>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '16px', fontWeight: '600' }}>Mencari member...</p>
          </div>
        )}

        {/* Result */}
        {!lookupLoading && lookupResult && (
          <div style={{ 
            padding: '24px', 
            backgroundColor: '#f9fafb', 
            border: '2px solid #e5e7eb', 
            borderRadius: '14px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '28px',
                flexShrink: 0
              }}>
                {lookupResult.fullName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', margin: '0 0 6px 0', fontWeight: '600' }}>
                  Nama Lengkap
                </p>
                <p style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>
                  {lookupResult.fullName}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', margin: '0 0 6px 0', fontWeight: '600' }}>
                  Telepon
                </p>
                <p style={{ fontWeight: '700', color: '#111827', margin: 0, fontSize: '15px' }}>
                  {lookupResult.phone}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', margin: '0 0 6px 0', fontWeight: '600' }}>
                  Status
                </p>
                {lookupResult.isActive ? (
                  <span style={{
                    display: 'inline-block',
                    padding: '6px 14px',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700'
                  }}>
                    ✓ Aktif
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-block',
                    padding: '6px 14px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700'
                  }}>
                    ✕ Nonaktif
                  </span>
                )}
              </div>
            </div>

            <div style={{ paddingTop: '16px', borderTop: '2px solid #e5e7eb', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', margin: '0 0 6px 0', fontWeight: '600' }}>
                Cabang Registrasi
              </p>
              <p style={{ fontWeight: '700', color: '#111827', margin: 0, fontSize: '15px' }}>
                🏢 {lookupResult.registrationBranch}
              </p>
            </div>

            <div style={{ paddingTop: '16px', borderTop: '2px solid #e5e7eb' }}>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px', margin: '0 0 10px 0', fontWeight: '600' }}>
                Status Akses
              </p>
              {lookupResult.sudahAdaAkses ? (
                <div style={{ 
                  padding: '14px', 
                  backgroundColor: '#dcfce7', 
                  border: '2px solid #86efac', 
                  borderRadius: '10px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px' 
                }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#16a34a' }}>
                    Sudah Ada Akses
                  </span>
                </div>
              ) : (
                <div style={{ 
                  padding: '14px', 
                  backgroundColor: '#fef3c7', 
                  border: '2px solid #fde047', 
                  borderRadius: '10px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px' 
                }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#ca8a04' }}>
                    Belum Ada Akses
                  </span>
                </div>
              )}
            </div>

            {!lookupResult.sudahAdaAkses && !lookupResult.isRegistrationBranch && (
              <button
                onClick={handleGrantAccess}
                disabled={grantingAccess}
                style={{
                  width: '100%',
                  marginTop: '18px',
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#22c55e',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '15px',
                  cursor: grantingAccess ? 'not-allowed' : 'pointer',
                  opacity: grantingAccess ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!grantingAccess) e.currentTarget.style.backgroundColor = '#16a34a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#22c55e';
                }}
              >
                {grantingAccess ? '⏳ Memberikan Akses...' : '🔓 Grant Akses ke Cabang Ini'}
              </button>
            )}
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: '3px solid #e5e7eb',
            backgroundColor: '#ffffff',
            color: '#374151',
            fontWeight: '700',
            fontSize: '15px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f9fafb';
            e.currentTarget.style.borderColor = '#d1d5db';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
