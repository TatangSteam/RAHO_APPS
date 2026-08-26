'use client';

import { useCallback, useEffect, useState } from 'react';
import NextImage from 'next/image';
import { CheckCircle2, Eye, Image as ImageIcon, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import { sessionApi, type WhatsAppReportBackground, type WhatsAppReportDelivery, type WhatsAppReportPreview } from '@/lib/sessionApi';

const DEFAULT_BACKGROUNDS: Array<{ key: WhatsAppReportBackground; name: string }> = [
  { key: 'RAHO_RED', name: 'Merah RAHO' },
  { key: 'HEALTH_GREEN', name: 'Hijau Sehat' },
  { key: 'PREMIUM_GOLD', name: 'Emas Premium' },
  { key: 'CLEAN_LIGHT', name: 'Minimal Terang' },
];

function idempotencyKey(sessionId: string) {
  return `SESSION_REPORT:MANUAL:${sessionId}:${crypto.randomUUID()}`;
}

export default function WhatsAppReportCard({
  sessionId,
  canManageConsent,
}: {
  sessionId: string;
  canManageConsent: boolean;
}) {
  const [background, setBackground] = useState<WhatsAppReportBackground>('RAHO_RED');
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

  const loadPreview = async (selected = background) => {
    try {
      setLoading(true);
      const result = await sessionApi.previewWhatsAppReport(sessionId, selected);
      setPreview(result);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Preview laporan WhatsApp gagal dimuat');
    } finally {
      setLoading(false);
    }
  };

  const changeConsent = async (enabled: boolean) => {
    try {
      setLoading(true);
      await sessionApi.updateWhatsAppConsent(sessionId, enabled);
      await loadPreview();
      showToast.success(enabled ? 'Consent WhatsApp berhasil dicatat' : 'Consent WhatsApp telah dicabut');
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Consent WhatsApp gagal diperbarui');
    } finally {
      setLoading(false);
    }
  };

  const queueReport = async () => {
    try {
      setSending(true);
      await sessionApi.queueWhatsAppReport(sessionId, {
        background,
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

  const backgrounds = preview?.availableBackgrounds || DEFAULT_BACKGROUNDS;
  return (
    <section className="card" style={{ marginTop: 24, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 750 }}>
            <MessageCircle size={21} color="#16a34a" /> Laporan WhatsApp
          </h3>
          <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Preview foto berbingkai dan caption sebelum masuk antrean pengiriman.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void loadPreview()} disabled={loading}>
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />} Preview
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <label htmlFor="wa-report-background" style={{ display: 'block', fontSize: 13, fontWeight: 650, marginBottom: 7 }}>
          Background laporan
        </label>
        <select
          id="wa-report-background"
          value={background}
          onChange={(event) => {
            const selected = event.target.value as WhatsAppReportBackground;
            setBackground(selected);
            if (preview) void loadPreview(selected);
          }}
          className="form-control"
          style={{ width: '100%', maxWidth: 360 }}
        >
          {backgrounds.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select>
      </div>

      {preview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 420px) minmax(260px, 1fr)', gap: 20, marginTop: 20 }}>
          <NextImage
            src={preview.imageDataUrl}
            alt={`Preview ${preview.background.name}`}
            width={1080}
            height={1080}
            unoptimized
            style={{ width: '100%', height: 'auto', borderRadius: 16, border: '1px solid var(--surface-border)' }}
          />
          <div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-input)', fontSize: 13 }}>
              <strong>Tujuan: {preview.recipientMasked || 'Nomor belum valid'}</strong>
              <p style={{ margin: '6px 0 0', color: preview.consentActive ? '#16a34a' : '#f59e0b' }}>
                <ShieldCheck size={15} style={{ display: 'inline', marginRight: 5 }} />
                {preview.consentActive ? 'Consent WhatsApp aktif' : 'Consent WhatsApp belum aktif'}
              </p>
            </div>
            <pre style={{ marginTop: 12, padding: 14, maxHeight: 310, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, border: '1px solid var(--surface-border)', borderRadius: 10 }}>
              {preview.caption}
            </pre>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 14 }}>
              {canManageConsent && !preview.consentActive && (
                <button type="button" className="btn btn-secondary" onClick={() => void changeConsent(true)} disabled={loading}>
                  <ShieldCheck size={16} /> Catat consent
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => void queueReport()} disabled={sending || !preview.readyToQueue}>
                <MessageCircle size={16} /> {sending ? 'Mengantrekan...' : 'Masukkan antrean'}
              </button>
            </div>
            {!preview.readyToQueue && (
              <small style={{ display: 'block', marginTop: 9, color: 'var(--text-muted)' }}>
                Pengiriman tersedia setelah nomor, consent, dan konfigurasi WhatsApp siap.
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
              <span>{delivery.status === 'SENT' && <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 5 }} />}{delivery.status} · percobaan {delivery.attempts}/{delivery.maxAttempts}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
