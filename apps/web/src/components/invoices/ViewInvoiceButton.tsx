'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState } from 'react';
import InvoiceModal from './InvoiceModal';
import { invoiceApi } from '@/lib/invoiceApi';
import type { Invoice } from '@/types/invoice';
import { devError } from '@/lib/logger';

interface Props {
  packageId: string;
  packageCode: string;
  status: string;
  documentLabel?: string;
}

export default function ViewInvoiceButton({ packageId, packageCode: _packageCode, status, documentLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const canShowDocument = ['PENDING_PAYMENT', 'WAITING_VERIFICATION', 'ACTIVE', 'EXPIRED'].includes(status);
  const isReceipt = status === 'ACTIVE' || status === 'EXPIRED';
  const label = documentLabel || (isReceipt ? 'Lihat Kwitansi' : 'Lihat Invoice');
  const isInvoiceButton = label.toLowerCase().includes('invoice');

  if (!canShowDocument) {
    return null;
  }

  const handleViewInvoice = async () => {
    try {
      setLoading(true);
      const data = await invoiceApi.getInvoiceByPackageId(packageId);
      setInvoice(data);
      setShowModal(true);
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load invoice:', error);
      
      // Check if it's a 404 error (invoice not found)
      if (error?.response?.status === 404 || error?.message?.includes('not found')) {
        alert('Invoice belum tersedia untuk paket ini.\n\nInvoice dibuat otomatis saat paket diassign. Jika paket sudah diassign tapi invoice belum ada, silakan hubungi admin.');
      } else {
        alert('Gagal memuat invoice. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="invoice-document-button"
        onClick={handleViewInvoice}
        disabled={loading}
        style={{
          padding: '6px 12px',
          background: isInvoiceButton ? '#2563EB' : '#16A34A',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          maxWidth: '100%'
        }}
      >
        {loading ? '⏳' : '📄'} {loading ? 'Loading...' : label}
      </button>

      <InvoiceModal
        show={showModal}
        invoice={invoice}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
