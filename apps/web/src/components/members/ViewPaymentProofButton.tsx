'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState } from 'react';
import PaymentProofModal from '../invoices/PaymentProofModal';
import { invoiceApi } from '@/lib/invoiceApi';
import { useAuthStore } from '@/stores/authStore';
import { devLog, devError } from '@/lib/logger';
import type { Invoice } from '@/types/invoice';

interface Props {
  packageId: string;
  packageCode: string;
  status: string;
}

export default function ViewPaymentProofButton({ 
  packageId, 
  packageCode: _packageCode,
  status
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuthStore();

  // Only show button for ACTIVE/EXPIRED packages
  if (status !== 'ACTIVE' && status !== 'EXPIRED') {
    return null;
  }

  const handleViewProof = async () => {
    // Check if user is authenticated
    if (!accessToken) {
      setError('Silakan login terlebih dahulu');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      devLog('🔍 Fetching invoice for package:', packageId);
      const data = await invoiceApi.getInvoiceByPackageId(packageId);
      
      devLog('🔍 ViewPaymentProofButton - Invoice Data:', {
        invoiceNumber: data.invoiceNumber,
        paymentsCount: data.payments?.length || 0,
        payments: data.payments?.map(p => ({
          id: p.id,
          amount: p.amount,
          proofFileUrl: p.proofFileUrl,
          proofFileName: p.proofFileName,
          proofMimeType: p.proofMimeType,
        }))
      });
      
      // Check if invoice has payment proof
      const hasPaymentProof = data.payments && data.payments.some((p) => p.proofFileUrl);
      
      if (!hasPaymentProof) {
        setError('Bukti pembayaran belum tersedia untuk invoice ini');
        setTimeout(() => setError(null), 3000);
        return;
      }

      setInvoice(data);
      setShowModal(true);
    } catch (err) {
      assertCaughtError(err);
      devError('Error fetching invoice:', err);
      devError('Error response:', err.response);
      
      // Show more specific error message
      if (err.response?.status === 401) {
        setError('Sesi Anda telah berakhir. Silakan login kembali.');
      } else if (err.response?.status === 404) {
        setError('Invoice tidak ditemukan untuk paket ini');
      } else {
        setError(err.response?.data?.error?.message || 'Gagal memuat bukti pembayaran');
      }
      
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleViewProof}
        disabled={loading}
        style={{
          padding: '6px 12px',
          background: loading ? '#6c757d' : '#17a2b8',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginLeft: '8px',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? '⏳ Loading...' : '🧾 Lihat Bukti'}
      </button>

      {error && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#dc3545',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '6px',
          zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {error}
        </div>
      )}

      {showModal && invoice && (
        <PaymentProofModal
          invoice={invoice}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
