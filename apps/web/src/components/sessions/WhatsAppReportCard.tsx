'use client';

import { useCallback, useEffect, useState } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, Image as ImageIcon, MessageCircle, Palette, RefreshCw } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import { sessionApi, type WhatsAppReportDelivery, type WhatsAppReportPreview } from '@/lib/sessionApi';
import { useAuthStore } from '@/stores/authStore';

function idempotencyKey(sessionId: string) {
  return `SESSION_REPORT:MANUAL:${sessionId}:${crypto.randomUUID()}`;
}

export default function WhatsAppReportCard({ sessionId }: { sessionId: string }) {
  const { user } = useAuthStore();
  const [preview, setPreview] = useState<WhatsAppReportPreview | null>(null);
  const [deliveries, setDeliveries] = useState<WhatsAppReportDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadDeliveries = useCallback(async () => {
    try {
      setDeliveries(await sessionApi.listWhatsAppDeliveries(sessionId));
    } catch {
      setDeliveries([]);
    }
  }, [sessionId]);

  useEffect(() => { void loadDeliveries(); }, [loadDeliveries]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const result = await sessionApi.previewWhatsAppReport(sessionId);
      setPreview(result);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Preview laporan WhatsApp gagal dimuat');
    } finally {
      setLoading(false);
    }
  };

  const queueReport = async () => {
    try {
      setSending(true);
      await sessionApi.queueWhatsAppReport(sessionId, {
        idempotencyKey: idempotencyKey(sessionId),
      });
      showToast.success('Laporan masuk antrean WhatsApp');
      await loadDeliveries();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Laporan gagal dimasukkan ke antrean');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="card" style={{ marginTop: 24, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 750 }}>
            <MessageCircle size={21} color="#16a34a" /> Laporan WhatsApp
          </h3>
          <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Periksa kartu bergambar dan pesan WhatsApp sebelum masuk antrean pengiriman.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void loadPreview()} disabled={loading}>
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />} Muat preview
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14, color: 'var(--text-muted)', fontSize: 12 }}>
        <Palette size={14} /> Template ditetapkan oleh Super Admin agar identitas laporan konsisten.
        {user?.role === 'SUPER_ADMIN' && (
          <Link href="/admin/integrations/whatsapp" style={{ color: '#f59e0b', fontWeight: 700 }}>Atur template</Link>
        )}
      </div>

      {preview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, marginTop: 20, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>KARTU LAPORAN 4:5</span>
              <strong style={{ color: 'var(--text-secondary)' }}>{preview.background.name}</strong>
            </div>
            <NextImage
              src={preview.imageDataUrl}
              alt={`Preview ${preview.background.name}`}
              width={1080}
              height={1350}
              unoptimized
              style={{ display: 'block', width: '100%', maxWidth: 430, height: 'auto', margin: '0 auto', borderRadius: 16, border: '1px solid var(--surface-border)', boxShadow: '0 12px 32px rgba(0,0,0,.2)' }}
            />
          </div>
          <div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-input)', fontSize: 13 }}>
              <strong>Tujuan: {preview.recipientMasked || 'Nomor belum valid'}</strong>
              <p style={{ margin: '6px 0 0', color: preview.phoneValid ? '#16a34a' : '#f59e0b' }}>
                {preview.phoneValid
                  ? <CheckCircle2 size={15} style={{ display: 'inline', marginRight: 5 }} />
                  : <AlertCircle size={15} style={{ display: 'inline', marginRight: 5 }} />}
                {preview.phoneValid ? 'Nomor WhatsApp valid' : 'Nomor WhatsApp belum valid'}
              </p>
              <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>
                Evaluasi dokter tidak wajib untuk pengiriman.
                {preview.doctorEvaluationIncluded ? ' Evaluasi tersedia dan ikut dimasukkan.' : ' Laporan dikirim tanpa evaluasi dokter.'}
              </p>
            </div>
            <div style={{ marginTop: 12, padding: '12px 10px 16px', borderRadius: 12, background: '#0b141a', border: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 4px 10px', color: '#d1d7db', fontSize: 11, fontWeight: 700 }}>
                <MessageCircle size={14} color="#25d366" /> PREVIEW PESAN WHATSAPP
              </div>
              <pre style={{ margin: 0, padding: 14, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.55, color: '#e9edef', background: '#005c4b', borderRadius: '7px 7px 2px 7px', boxShadow: '0 1px 1px rgba(0,0,0,.2)' }}>
                {preview.caption}
              </pre>
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" className="btn btn-primary" onClick={() => void queueReport()} disabled={sending || !preview.readyToQueue}>
                <MessageCircle size={16} /> {sending ? 'Mengantrekan...' : 'Masukkan antrean'}
              </button>
            </div>
            {!preview.readyToQueue && (
              <small style={{ display: 'block', marginTop: 9, color: 'var(--text-muted)' }}>
                Pengiriman tersedia setelah nomor, data sesi, dan konfigurasi WhatsApp siap.
              </small>
            )}
          </div>
        </div>
      )}

      {deliveries.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <strong style={{ fontSize: 13 }}>Riwayat antrean</strong>
          {deliveries.map((delivery) => (
            <div key={delivery.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--surface-border)', fontSize: 12 }}>
              <span><ImageIcon size={14} style={{ display: 'inline', marginRight: 6 }} />{delivery.recipientMasked}</span>
              <span>{delivery.status === 'SENT' && <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 5 }} />}{delivery.status}{' \u00B7 '}percobaan {delivery.attempts}/{delivery.maxAttempts}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
