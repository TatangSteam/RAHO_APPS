'use client';

import { useState, useEffect, useRef } from 'react';
import { icdApi, type ICDCode } from '@/lib/icdApi';
import { devError } from '@/lib/logger';

const ICD_DISPLAY_LIMIT = 80;

interface ICDSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  category?: string;
}

export default function ICDSearchInput({
  value,
  onChange,
  placeholder = 'Cari kode ICD...',
  label,
  disabled = false,
  category,
}: ICDSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ICDCode[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [selectedCode, setSelectedCode] = useState<ICDCode | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial common codes (independent of category)
  useEffect(() => {
    loadInitialCodes();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSelectedCode = async () => {
      if (!value) {
        setSelectedCode(null);
        return;
      }

      const existing = results.find(
        (item) =>
          item.code.toUpperCase() === value.toUpperCase() ||
          item.parent?.toUpperCase() === value.toUpperCase()
      );

      if (existing) {
        setSelectedCode(existing);
        return;
      }

      const code = await icdApi.getICDByCode(value);
      if (!cancelled) {
        setSelectedCode(code);
      }
    };

    loadSelectedCode();

    return () => {
      cancelled = true;
    };
  }, [value, results]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search ICD codes (completely independent of category)
  useEffect(() => {
    const searchCodes = async () => {
      if (!showDropdown) return;

      setLoading(true);
      try {
        // Always use general search - no category filtering
        const { results, total } = await icdApi.searchICDWithTotal(query, ICD_DISPLAY_LIMIT);
        setResults(results);
        setResultTotal(total);
      } catch (error) {
        devError('Failed to search ICD codes:', error);
        setResults([]);
        setResultTotal(0);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchCodes, 300);
    return () => clearTimeout(debounce);
  }, [query, showDropdown]);

  const loadInitialCodes = async () => {
    try {
      // Always load all common ICD codes - ignore category
      const codes = await icdApi.getCommonICDCodes();
      setResults(codes.slice(0, ICD_DISPLAY_LIMIT));
      setResultTotal(codes.length);
    } catch (error) {
      devError('Failed to load common ICD codes:', error);
      setResults([]);
      setResultTotal(0);
    }
  };

  const handleSelect = (code: ICDCode) => {
    onChange(icdApi.completeICDCode(code.code));
    setSelectedCode(code);
    setQuery('');
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  };

  const normalizedManualCode = query.trim().toUpperCase();
  const canUseManualCode = /^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?$/.test(normalizedManualCode);
  const manualCode = canUseManualCode ? icdApi.completeICDCode(normalizedManualCode) : '';
  const displayResults = canUseManualCode && !results.some((code) => code.code.toUpperCase() === manualCode)
    ? [{ code: manualCode, title: 'Gunakan kode ICD ini' }, ...results]
    : results;
  const visibleResultCount = displayResults.length;
  const totalResultCount = resultTotal || visibleResultCount;
  const resultRangeEnd = Math.min(visibleResultCount, totalResultCount);
  const getDisplayTitle = (code: ICDCode) => {
    if (code.namaIndonesia && code.englishName) {
      return `${code.namaIndonesia} - ${code.englishName}`;
    }

    return code.title || code.englishName || code.namaIndonesia || 'Kode ICD tersimpan';
  };

  return (
    <div className="form-group" ref={dropdownRef}>
      {label && <label className="form-label">{label}</label>}
      
      <div style={{ position: 'relative' }}>
        {/* Selected value display */}
        {value && !showDropdown ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              background: 'var(--surface-input)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            onClick={() => !disabled && setShowDropdown(true)}
          >
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-primary-400)', flexShrink: 0 }}>
              {value}
            </span>
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>
              {selectedCode ? getDisplayTitle(selectedCode) : 'Kode ICD tersimpan'}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="form-input"
            autoComplete="off"
          />
        )}

        {/* Dropdown */}
        {showDropdown && !disabled && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md)',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {loading ? (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto' }}></div>
              </div>
            ) : displayResults.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Tidak ada hasil
              </div>
            ) : (
              <div>
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '8px 12px',
                    background: 'var(--surface-card)',
                    borderBottom: '1px solid var(--surface-border)',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    zIndex: 1,
                  }}
                >
                  {visibleResultCount > 0 ? `1-${resultRangeEnd} / ${totalResultCount}` : `0 / ${totalResultCount}`}
                </div>
                {displayResults.map((code) => (
                  <button
                    key={code.code}
                    type="button"
                    onClick={() => handleSelect(code)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--surface-border)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(148, 163, 184, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          fontFamily: 'monospace',
                          color: 'var(--color-primary-400)',
                        }}
                      >
                        {code.code}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{getDisplayTitle(code)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {value && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Klik untuk mengubah atau ✕ untuk menghapus
        </p>
      )}
    </div>
  );
}
