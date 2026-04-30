'use client';

import { useState, useEffect } from 'react';
import type { CreateMemberData } from '@/types/member';

interface IncentiveSectionProps {
  formData: CreateMemberData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  showIncentiveSettings: boolean;
}

export default function IncentiveSection({ formData, onChange, showIncentiveSettings }: IncentiveSectionProps) {
  if (!showIncentiveSettings) {
    return null;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--surface-border)' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '18px'
        }}>
          💰
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Pengaturan Insentif</h2>
      </div>

      <div style={{ 
        padding: '16px', 
        background: 'rgba(245, 158, 11, 0.1)', 
        border: '1px solid rgba(245, 158, 11, 0.3)', 
        borderRadius: 'var(--radius-lg)', 
        marginBottom: '24px' 
      }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
          ℹ️ <strong>Pengaturan Insentif Khusus:</strong> Jika tidak diisi, sistem akan menggunakan nilai default (10% untuk paket pertama, 5% untuk paket selanjutnya).
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* First Package Incentive */}
        <div style={{ 
          padding: '20px', 
          background: 'rgba(34, 197, 94, 0.05)', 
          border: '2px solid rgba(34, 197, 94, 0.2)', 
          borderRadius: 'var(--radius-lg)' 
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎯 Insentif Paket Pertama
          </h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label className="form-label">Tipe Insentif</label>
              <select
                name="firstIncentiveType"
                value={formData.firstIncentiveType || ''}
                onChange={onChange}
                className="form-input"
              >
                <option value="">Pilih tipe insentif...</option>
                <option value="PERCENTAGE">Persentase (%)</option>
                <option value="FIXED_AMOUNT">Nominal Tetap (Rp)</option>
              </select>
            </div>

            <div>
              <label className="form-label">
                Nilai Insentif {formData.firstIncentiveType === 'PERCENTAGE' ? '(%)' : formData.firstIncentiveType === 'FIXED_AMOUNT' ? '(Rp)' : ''}
              </label>
              <input
                type="number"
                name="firstIncentiveValue"
                value={formData.firstIncentiveValue || ''}
                onChange={onChange}
                className="form-input"
                placeholder={formData.firstIncentiveType === 'PERCENTAGE' ? 'Contoh: 10' : formData.firstIncentiveType === 'FIXED_AMOUNT' ? 'Contoh: 50000' : 'Pilih tipe terlebih dahulu'}
                min="0"
                step={formData.firstIncentiveType === 'PERCENTAGE' ? '0.1' : '1000'}
                disabled={!formData.firstIncentiveType}
              />
              {formData.firstIncentiveType === 'PERCENTAGE' && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Persentase dari harga paket (contoh: 10 = 10%)
                </p>
              )}
              {formData.firstIncentiveType === 'FIXED_AMOUNT' && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Nominal tetap dalam Rupiah
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Next Package Incentive */}
        <div style={{ 
          padding: '20px', 
          background: 'rgba(59, 130, 246, 0.05)', 
          border: '2px solid rgba(59, 130, 246, 0.2)', 
          borderRadius: 'var(--radius-lg)' 
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔄 Insentif Paket Selanjutnya
          </h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label className="form-label">Tipe Insentif</label>
              <select
                name="nextIncentiveType"
                value={formData.nextIncentiveType || ''}
                onChange={onChange}
                className="form-input"
              >
                <option value="">Pilih tipe insentif...</option>
                <option value="PERCENTAGE">Persentase (%)</option>
                <option value="FIXED_AMOUNT">Nominal Tetap (Rp)</option>
              </select>
            </div>

            <div>
              <label className="form-label">
                Nilai Insentif {formData.nextIncentiveType === 'PERCENTAGE' ? '(%)' : formData.nextIncentiveType === 'FIXED_AMOUNT' ? '(Rp)' : ''}
              </label>
              <input
                type="number"
                name="nextIncentiveValue"
                value={formData.nextIncentiveValue || ''}
                onChange={onChange}
                className="form-input"
                placeholder={formData.nextIncentiveType === 'PERCENTAGE' ? 'Contoh: 5' : formData.nextIncentiveType === 'FIXED_AMOUNT' ? 'Contoh: 25000' : 'Pilih tipe terlebih dahulu'}
                min="0"
                step={formData.nextIncentiveType === 'PERCENTAGE' ? '0.1' : '1000'}
                disabled={!formData.nextIncentiveType}
              />
              {formData.nextIncentiveType === 'PERCENTAGE' && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Persentase dari harga paket (contoh: 5 = 5%)
                </p>
              )}
              {formData.nextIncentiveType === 'FIXED_AMOUNT' && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Nominal tetap dalam Rupiah
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {(formData.firstIncentiveType || formData.nextIncentiveType) && (
        <div style={{ 
          marginTop: '24px', 
          padding: '16px', 
          background: 'rgba(168, 85, 247, 0.05)', 
          border: '1px solid rgba(168, 85, 247, 0.2)', 
          borderRadius: 'var(--radius-lg)' 
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
            📋 Preview Pengaturan Insentif
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
            <div>
              <strong>Paket Pertama:</strong>{' '}
              {formData.firstIncentiveType && formData.firstIncentiveValue ? (
                <span style={{ color: '#22c55e' }}>
                  {formData.firstIncentiveType === 'PERCENTAGE' 
                    ? `${formData.firstIncentiveValue}%` 
                    : `Rp ${Number(formData.firstIncentiveValue).toLocaleString('id-ID')}`
                  }
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Default (10%)</span>
              )}
            </div>
            <div>
              <strong>Paket Selanjutnya:</strong>{' '}
              {formData.nextIncentiveType && formData.nextIncentiveValue ? (
                <span style={{ color: '#3b82f6' }}>
                  {formData.nextIncentiveType === 'PERCENTAGE' 
                    ? `${formData.nextIncentiveValue}%` 
                    : `Rp ${Number(formData.nextIncentiveValue).toLocaleString('id-ID')}`
                  }
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Default (5%)</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}