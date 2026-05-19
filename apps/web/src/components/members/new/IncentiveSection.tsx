'use client';

import { useState, useEffect } from 'react';
import type { CreateMemberData } from '@/types/member';

interface IncentiveSectionProps {
  formData: CreateMemberData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  showIncentiveSettings: boolean;
}

// Helper function to format currency input
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null || isNaN(value)) return '';
  return value.toLocaleString('id-ID');
};

// Helper function to parse currency input (remove dots)
const parseCurrency = (value: string): number => {
  const cleaned = value.replace(/\./g, '').replace(/,/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
};

export default function IncentiveSection({ formData, onChange, showIncentiveSettings }: IncentiveSectionProps) {
  // Local state for formatted display values
  const [firstValueDisplay, setFirstValueDisplay] = useState('');
  const [nextValueDisplay, setNextValueDisplay] = useState('');

  // Sync display values with form data
  useEffect(() => {
    if (formData.firstIncentiveType === 'FIXED_AMOUNT' && formData.firstIncentiveValue !== undefined) {
      setFirstValueDisplay(formatCurrency(formData.firstIncentiveValue));
    } else if (formData.firstIncentiveType === 'PERCENTAGE' && formData.firstIncentiveValue !== undefined) {
      setFirstValueDisplay(String(formData.firstIncentiveValue));
    } else {
      setFirstValueDisplay('');
    }
  }, [formData.firstIncentiveValue, formData.firstIncentiveType]);

  useEffect(() => {
    if (formData.nextIncentiveType === 'FIXED_AMOUNT' && formData.nextIncentiveValue !== undefined) {
      setNextValueDisplay(formatCurrency(formData.nextIncentiveValue));
    } else if (formData.nextIncentiveType === 'PERCENTAGE' && formData.nextIncentiveValue !== undefined) {
      setNextValueDisplay(String(formData.nextIncentiveValue));
    } else {
      setNextValueDisplay('');
    }
  }, [formData.nextIncentiveValue, formData.nextIncentiveType]);

  // Handle first incentive value change
  const handleFirstValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    if (formData.firstIncentiveType === 'FIXED_AMOUNT') {
      // For currency, parse and format
      const numValue = parseCurrency(rawValue);
      setFirstValueDisplay(rawValue === '' ? '' : formatCurrency(numValue));
      
      // Send numeric value to parent
      const syntheticEvent = {
        target: {
          name: 'firstIncentiveValue',
          value: rawValue === '' ? '' : String(numValue),
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    } else {
      // For percentage, just use the raw value (allow decimals)
      setFirstValueDisplay(rawValue);
      
      const syntheticEvent = {
        target: {
          name: 'firstIncentiveValue',
          value: rawValue,
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  // Handle next incentive value change
  const handleNextValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    if (formData.nextIncentiveType === 'FIXED_AMOUNT') {
      // For currency, parse and format
      const numValue = parseCurrency(rawValue);
      setNextValueDisplay(rawValue === '' ? '' : formatCurrency(numValue));
      
      // Send numeric value to parent
      const syntheticEvent = {
        target: {
          name: 'nextIncentiveValue',
          value: rawValue === '' ? '' : String(numValue),
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    } else {
      // For percentage, just use the raw value (allow decimals)
      setNextValueDisplay(rawValue);
      
      const syntheticEvent = {
        target: {
          name: 'nextIncentiveValue',
          value: rawValue,
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  // Reset display value when type changes
  const handleFirstTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFirstValueDisplay('');
    // Clear the value when type changes
    const clearEvent = {
      target: {
        name: 'firstIncentiveValue',
        value: '',
      }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(clearEvent);
    onChange(e);
  };

  const handleNextTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNextValueDisplay('');
    // Clear the value when type changes
    const clearEvent = {
      target: {
        name: 'nextIncentiveValue',
        value: '',
      }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(clearEvent);
    onChange(e);
  };

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
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Pengaturan Insentif Referral (Opsional)</h2>
      </div>

      <div style={{ 
        padding: '16px', 
        background: 'rgba(59, 130, 246, 0.1)', 
        border: '1px solid rgba(59, 130, 246, 0.3)', 
        borderRadius: 'var(--radius-lg)', 
        marginBottom: '24px' 
      }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
          ℹ️ <strong>Catatan:</strong> Insentif ditentukan per member. Setiap member dapat memiliki rate insentif yang berbeda meskipun menggunakan kode referral yang sama.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* First Package Incentive */}
        <div>
          <label className="form-label">Insentif Paket Pertama - Tipe</label>
          <select
            name="firstIncentiveType"
            value={formData.firstIncentiveType || ''}
            onChange={handleFirstTypeChange}
            className="form-input"
          >
            <option value="">Pilih tipe...</option>
            <option value="PERCENTAGE">Persentase (%)</option>
            <option value="FIXED_AMOUNT">Nominal (Rp)</option>
          </select>
        </div>

        <div>
          <label className="form-label">Nilai Insentif Pertama</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={firstValueDisplay}
              onChange={handleFirstValueChange}
              className="form-input"
              placeholder={
                formData.firstIncentiveType === 'PERCENTAGE' 
                  ? 'Contoh: 10' 
                  : formData.firstIncentiveType === 'FIXED_AMOUNT' 
                    ? 'Contoh: 50.000' 
                    : 'Pilih tipe dulu'
              }
              disabled={!formData.firstIncentiveType}
              style={{ 
                paddingRight: formData.firstIncentiveType ? '50px' : undefined 
              }}
            />
            {formData.firstIncentiveType && (
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '14px',
                fontWeight: '500',
              }}>
                {formData.firstIncentiveType === 'PERCENTAGE' ? '%' : 'Rp'}
              </span>
            )}
          </div>
        </div>

        {/* Next Package Incentive */}
        <div>
          <label className="form-label">Insentif Paket Lanjutan - Tipe</label>
          <select
            name="nextIncentiveType"
            value={formData.nextIncentiveType || ''}
            onChange={handleNextTypeChange}
            className="form-input"
          >
            <option value="">Pilih tipe...</option>
            <option value="PERCENTAGE">Persentase (%)</option>
            <option value="FIXED_AMOUNT">Nominal (Rp)</option>
          </select>
        </div>

        <div>
          <label className="form-label">Nilai Insentif Lanjutan</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={nextValueDisplay}
              onChange={handleNextValueChange}
              className="form-input"
              placeholder={
                formData.nextIncentiveType === 'PERCENTAGE' 
                  ? 'Contoh: 5' 
                  : formData.nextIncentiveType === 'FIXED_AMOUNT' 
                    ? 'Contoh: 25.000' 
                    : 'Pilih tipe dulu'
              }
              disabled={!formData.nextIncentiveType}
              style={{ 
                paddingRight: formData.nextIncentiveType ? '50px' : undefined 
              }}
            />
            {formData.nextIncentiveType && (
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '14px',
                fontWeight: '500',
              }}>
                {formData.nextIncentiveType === 'PERCENTAGE' ? '%' : 'Rp'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}