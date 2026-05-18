'use client';

import { useState, useEffect } from 'react';
import { X, Shield, Search, UserPlus, Loader2, Check } from 'lucide-react';
import { branchesApi } from '@/lib/api/branchesApi';
import { showToast } from '@/lib/toast';
import styles from '@/styles/crud-modal.module.css';

interface AvailableManager {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

interface AssignManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
  branchName: string;
}

export default function AssignManagerModal({
  isOpen,
  onClose,
  onSuccess,
  branchId,
  branchName,
}: AssignManagerModalProps) {
  const [managers, setManagers] = useState<AvailableManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAvailableManagers();
      setSelectedManagerId(null);
      setSearchTerm('');
    }
  }, [isOpen, branchId]);

  const loadAvailableManagers = async () => {
    try {
      setLoading(true);
      const response = await branchesApi.getAvailableManagers(branchId);
      setManagers(response.data.data || []);
    } catch (error: any) {
      console.error('Error loading available managers:', error);
      showToast.error('Gagal memuat daftar Admin Manager');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedManagerId) {
      showToast.error('Pilih Admin Manager terlebih dahulu');
      return;
    }

    try {
      setSubmitting(true);
      await branchesApi.assignManager(branchId, selectedManagerId);
      showToast.success('Admin Manager berhasil di-assign ke cabang');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error assigning manager:', error);
      showToast.error(error.response?.data?.message || 'Gagal assign Admin Manager');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredManagers = managers.filter(
    (m) =>
      m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modalContent} 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Shield size={22} style={{ color: '#8b5cf6' }} />
            <h2>Assign Admin Manager</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalForm}>
          {/* Info Box */}
          <div className={styles.infoBox}>
            Pilih Admin Manager untuk di-assign ke cabang <strong>{branchName}</strong>
          </div>

          {/* Search Input */}
          <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Cari berdasarkan nama atau email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '42px',
                }}
              />
            </div>
          </div>

          {/* Manager List */}
          {loading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '48px 20px',
              background: 'var(--surface-ground)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <Loader2 
                size={36} 
                style={{ 
                  color: '#8b5cf6',
                  animation: 'spin 1s linear infinite',
                }} 
              />
              <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Memuat daftar Admin Manager...
              </p>
            </div>
          ) : filteredManagers.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: 'var(--surface-ground)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--surface-border)',
              }}
            >
              <Shield size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
              <h4 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                {searchTerm ? 'Tidak Ditemukan' : 'Tidak Ada Admin Manager'}
              </h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                {searchTerm
                  ? 'Tidak ada Admin Manager yang cocok dengan pencarian.'
                  : 'Semua Admin Manager sudah di-assign ke cabang ini atau belum ada Admin Manager yang dibuat.'}
              </p>
            </div>
          ) : (
            <div
              style={{
                maxHeight: '280px',
                overflowY: 'auto',
                border: '2px solid var(--surface-border)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface-bg)',
              }}
            >
              {filteredManagers.map((manager, index) => (
                <div
                  key={manager.id}
                  onClick={() => setSelectedManagerId(manager.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderBottom: index < filteredManagers.length - 1 ? '1px solid var(--surface-border)' : 'none',
                    background: selectedManagerId === manager.id
                      ? 'rgba(139, 92, 246, 0.12)'
                      : 'transparent',
                    borderLeft: selectedManagerId === manager.id
                      ? '3px solid #8b5cf6'
                      : '3px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: selectedManagerId === manager.id
                        ? 'rgba(139, 92, 246, 0.25)'
                        : 'rgba(139, 92, 246, 0.12)',
                      color: '#8b5cf6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '17px',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {manager.fullName.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      marginBottom: '2px',
                    }}>
                      {manager.fullName}
                    </div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {manager.email}
                    </div>
                    {manager.phone && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                      }}>
                        {manager.phone}
                      </div>
                    )}
                  </div>

                  {/* Check Icon */}
                  {selectedManagerId === manager.id && (
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: '#8b5cf6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={16} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalActions}>
          <button 
            type="button" 
            className={styles.cancelButton} 
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSubmit}
            disabled={!selectedManagerId || submitting}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Assign Manager</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
