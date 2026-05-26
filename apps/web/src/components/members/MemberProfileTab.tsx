'use client';

import { useState, useEffect } from 'react';
import { MemberDetail } from '@/types/member';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { getReferralIncentivesApi } from '@/lib/membersApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';

interface MemberProfileTabProps {
  member: MemberDetail;
}

interface IncentiveRecord {
  id: string;
  packageCode: string;
  packageType: string;
  packageName: string;
  packageValue: number;
  isFirstPackage: boolean;
  incentiveType: string;
  incentiveValue: number;
  incentiveAmount: number;
  notes: string | null;
  purchaseDate: string;
  createdAt: string;
}

export default function MemberProfileTab({ 
  member
}: MemberProfileTabProps) {
  const [loadingDocUrl, setLoadingDocUrl] = useState<string | null>(null);
  const [incentiveData, setIncentiveData] = useState<{
    totalIncentive: number;
    records: IncentiveRecord[];
  } | null>(null);
  const [loadingIncentives, setLoadingIncentives] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (member.referralCodeId) {
      loadIncentives();
    }
  }, [member.referralCodeId]);

  const loadIncentives = async () => {
    try {
      setLoadingIncentives(true);
      const data = await getReferralIncentivesApi(member.memberId);
      setIncentiveData(data);
    } catch (error: any) {
      devError('Failed to load incentives:', error);
      showToast.error('Gagal memuat data insentif');
    } finally {
      setLoadingIncentives(false);
    }
  };

  // Pagination logic
  const getPaginatedRecords = () => {
    if (!incentiveData) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return incentiveData.records.slice(startIndex, endIndex);
  };

  const totalPages = incentiveData ? Math.ceil(incentiveData.records.length / itemsPerPage) : 0;

  const handleViewDocument = async (fileUrl: string, fileName: string) => {
    try {
      setLoadingDocUrl(fileUrl);
      const blobUrl = await createAuthenticatedObjectUrl(fileUrl);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message;
      
      switch (errorCode) {
        case 'DOCUMENT_NOT_FOUND':
          showToast.error('Dokumen tidak ditemukan');
          break;
        case 'FILE_NOT_FOUND':
          showToast.error('File tidak ditemukan');
          break;
        case 'STORAGE_UNAVAILABLE':
          showToast.error('Layanan penyimpanan tidak tersedia. Silakan coba lagi.');
          break;
        default:
          showToast.error(errorMessage || 'Gagal membuka dokumen');
      }
    } finally {
      setLoadingDocUrl(null);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>📝 Data Pribadi</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>NIK</p>
            <p style={{ fontWeight: '600', fontFamily: 'monospace' }}>{member.nik || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tempat, Tanggal Lahir</p>
            <p style={{ fontWeight: '600' }}>
              {member.tempatLahir || '-'}
              {member.dateOfBirth && `, ${new Date(member.dateOfBirth).toLocaleDateString('id-ID')}`}
            </p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Jenis Kelamin</p>
            <p style={{ fontWeight: '600' }}>
              {member.jenisKelamin === 'L' ? '👨 Laki-laki' : member.jenisKelamin === 'P' ? '👩 Perempuan' : '-'}
            </p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Telepon</p>
            <p style={{ fontWeight: '600' }}>📞 {member.profile.phone}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Email</p>
            <p style={{ fontWeight: '600', wordBreak: 'break-all' }}>📧 {member.user.email}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pekerjaan</p>
            <p style={{ fontWeight: '600' }}>💼 {member.pekerjaan || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)', gridColumn: '1 / -1' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Alamat</p>
            <p style={{ fontWeight: '600' }}>🏠 {member.address || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status Nikah</p>
            <p style={{ fontWeight: '600' }}>💍 {member.statusNikah || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Kontak Darurat</p>
            <p style={{ fontWeight: '600' }}>🚨 {member.emergencyContact || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Sumber Info</p>
            <p style={{ fontWeight: '600' }}>ℹ️ {member.sumberInfoRaho || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Kode Pos</p>
            <p style={{ fontWeight: '600' }}>📮 {member.postalCode || '-'}</p>
          </div>
        </div>
      </div>

      {/* Referral Information - Always show for debugging */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>🎁 Informasi Referral</h3>
        {member.referralCode ? (
          <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(139,92,246,0.05))', border: '2px solid rgba(168,85,247,0.3)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Kode Referral</p>
              <p style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '18px', color: '#a855f7', marginBottom: '8px' }}>{member.referralCode.code}</p>
              <p style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px', color: 'var(--text-primary)' }}>{member.referralCode.referrerName}</p>
              <span style={{ 
                display: 'inline-block',
                padding: '4px 12px', 
                background: 'rgba(168,85,247,0.2)', 
                borderRadius: 'var(--radius-md)', 
                fontSize: '12px', 
                fontWeight: '600',
                color: '#a855f7',
                textTransform: 'uppercase'
              }}>
                {member.referralCode.referrerType}
              </span>
            </div>
            
            {(member.firstIncentiveType || member.nextIncentiveType) && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(168,85,247,0.2)' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>💰 Pengaturan Insentif</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {member.firstIncentiveType && (
                    <div style={{ padding: '12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Paket Pertama</p>
                      <p style={{ fontWeight: '700', fontSize: '16px', color: '#22c55e' }}>
                        {member.firstIncentiveType === 'PERCENTAGE' 
                          ? `${member.firstIncentiveValue}%` 
                          : `Rp ${Number(member.firstIncentiveValue).toLocaleString('id-ID')}`
                        }
                      </p>
                    </div>
                  )}
                  {member.nextIncentiveType && (
                    <div style={{ padding: '12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Paket Lanjutan</p>
                      <p style={{ fontWeight: '700', fontSize: '16px', color: '#3b82f6' }}>
                        {member.nextIncentiveType === 'PERCENTAGE' 
                          ? `${member.nextIncentiveValue}%` 
                          : `Rp ${Number(member.nextIncentiveValue).toLocaleString('id-ID')}`
                        }
                      </p>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                  ℹ️ Insentif dihitung per paket yang diassign
                </p>
              </div>
            )}

            {/* Incentive Records Section */}
            {loadingIncentives ? (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(168,85,247,0.2)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>⏳ Memuat data insentif...</p>
              </div>
            ) : incentiveData && incentiveData.records.length > 0 ? (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(168,85,247,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>💸 Total Insentif yang Didapat</p>
                  <p style={{ fontSize: '20px', fontWeight: '700', color: '#22c55e' }}>
                    Rp {incentiveData.totalIncentive.toLocaleString('id-ID')}
                  </p>
                </div>
                
                {/* Dropdown Toggle Button */}
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={() => {
                      setShowPurchaseHistory(!showPurchaseHistory);
                      if (!showPurchaseHistory) {
                        setCurrentPage(1); // Reset to first page when opening
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(168,85,247,0.1)',
                      border: '1px solid rgba(168,85,247,0.3)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(168,85,247,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(168,85,247,0.1)';
                    }}
                  >
                    <span>📋 Riwayat Pembelian ({incentiveData.records.length})</span>
                    <span style={{ fontSize: '16px', transition: 'transform 0.2s', transform: showPurchaseHistory ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </button>

                  {/* Dropdown Content */}
                  {showPurchaseHistory && (
                    <div style={{ marginTop: '12px', animation: 'slideDown 0.2s ease-out' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {getPaginatedRecords().map((record) => (
                          <div 
                            key={record.id} 
                            style={{ 
                              padding: '12px', 
                              background: 'rgba(255,255,255,0.05)', 
                              border: '1px solid rgba(168,85,247,0.2)', 
                              borderRadius: 'var(--radius-md)',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div>
                                <p style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                  {record.packageCode}
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  {record.packageName}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ fontWeight: '700', fontSize: '14px', color: '#22c55e' }}>
                                  +Rp {record.incentiveAmount.toLocaleString('id-ID')}
                                </p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {record.incentiveType === 'PERCENTAGE' 
                                    ? `${record.incentiveValue}%` 
                                    : `Rp ${record.incentiveValue.toLocaleString('id-ID')}`
                                  }
                                </p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                              <span>
                                {record.isFirstPackage ? '🎉 Paket Pertama' : '🔄 Paket Lanjutan'}
                              </span>
                              <span>
                                📅 {new Date(record.purchaseDate).toLocaleDateString('id-ID', { 
                                  day: 'numeric', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div style={{ 
                          marginTop: '12px', 
                          display: 'flex', 
                          justifyContent: 'center', 
                          alignItems: 'center', 
                          gap: '8px' 
                        }}>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                              padding: '6px 12px',
                              background: currentPage === 1 ? 'rgba(148,163,184,0.1)' : 'rgba(168,85,247,0.2)',
                              border: '1px solid rgba(168,85,247,0.3)',
                              borderRadius: 'var(--radius-md)',
                              color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            ← Prev
                          </button>
                          
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                            Halaman {currentPage} dari {totalPages}
                          </span>
                          
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            style={{
                              padding: '6px 12px',
                              background: currentPage === totalPages ? 'rgba(148,163,184,0.1)' : 'rgba(168,85,247,0.2)',
                              border: '1px solid rgba(168,85,247,0.3)',
                              borderRadius: 'var(--radius-md)',
                              color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : incentiveData && incentiveData.records.length === 0 ? (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(168,85,247,0.2)' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  📭 Belum ada pembelian paket dari member ini
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ padding: '16px', background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              ❌ Member ini tidak menggunakan kode referral
            </p>
            {/* Debug info */}
            <details style={{ marginTop: '12px' }}>
              <summary style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>Debug Info</summary>
              <pre style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px', overflow: 'auto' }}>
                {JSON.stringify({
                  referralCodeId: member.referralCodeId,
                  referralCode: member.referralCode,
                  firstIncentiveType: member.firstIncentiveType,
                  firstIncentiveValue: member.firstIncentiveValue,
                  nextIncentiveType: member.nextIncentiveType,
                  nextIncentiveValue: member.nextIncentiveValue
                }, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      {member.documents.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>📄 Dokumen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {member.documents.map((doc) => (
              <div key={doc.id} className="card card-sm">
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: '600' }}>
                  {doc.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN' ? '📋 Dokumen PSP' : '📸 Foto Member'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', wordBreak: 'break-all' }}>{doc.fileName}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  📅 {new Date(doc.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <button
                  type="button"
                  onClick={() => handleViewDocument(doc.fileUrl, doc.fileName)}
                  disabled={loadingDocUrl === doc.fileUrl}
                  className="btn btn-sm btn-primary btn-full"
                  style={{ opacity: loadingDocUrl === doc.fileUrl ? 0.6 : 1 }}
                >
                  {loadingDocUrl === doc.fileUrl ? '⏳ Memuat...' : '👁️ Lihat File'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {member.branchAccess && member.branchAccess.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>🔗 Akses Lintas Cabang</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {member.branchAccess.map((access) => (
              <div key={access.branchId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontWeight: '600' }}>🏢 {access.branchName}</span>
                <span className="badge badge-cyan">
                  {new Date(access.grantedAt).toLocaleDateString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}