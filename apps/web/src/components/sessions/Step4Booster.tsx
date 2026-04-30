'use client';

import { useState, useEffect } from 'react';
import { showToast } from '@/lib/toast';
import { sessionApi } from '@/lib/sessionApi';

interface StockAvailability {
  HHO: { available: boolean; stock: number; minThreshold: number; isLowStock: boolean; unit: string };
  NO2: { available: boolean; stock: number; minThreshold: number; isLowStock: boolean; unit: string };
}

interface Step4BoosterProps {
  sessionId: string;
  currentBoosterType: string | null;
  onBoosterTypeSelected: () => void;
}

export default function Step4Booster({ 
  sessionId, 
  currentBoosterType,
  onBoosterTypeSelected 
}: Step4BoosterProps) {
  const [boosterType, setBoosterType] = useState<string>(currentBoosterType || '');
  const [saving, setSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(!!currentBoosterType);
  const [stockAvailability, setStockAvailability] = useState<StockAvailability | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (currentBoosterType) {
      setBoosterType(currentBoosterType);
      setIsReadOnly(true);
    }
  }, [currentBoosterType]);

  useEffect(() => {
    fetchStockAvailability();
  }, [sessionId]);

  const fetchStockAvailability = async () => {
    try {
      setLoadingStock(true);
      const stock = await sessionApi.getBoosterStockAvailability(sessionId);
      setStockAvailability(stock);
    } catch (error: any) {
      console.error('Error fetching stock availability:', error);
      showToast.error('Gagal memuat ketersediaan stok');
    } finally {
      setLoadingStock(false);
    }
  };

  const handleSave = async () => {
    if (!boosterType) {
      showToast.error('Pilih jenis booster terlebih dahulu');
      return;
    }

    if (!stockAvailability) {
      showToast.error('Data stok belum dimuat');
      return;
    }

    const selectedStock = stockAvailability[boosterType as keyof StockAvailability];
    if (!selectedStock.available) {
      showToast.error(`Stok ${boosterType === 'HHO' ? 'Gassotraus (HHO)' : 'Nitric Oxide (NO₂)'} tidak tersedia`);
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmSave = async () => {
    try {
      setSaving(true);
      setShowConfirmDialog(false);
      await sessionApi.updateBoosterType(sessionId, { boosterType: boosterType as any });
      showToast.success('Jenis booster berhasil disimpan dan stok telah dikurangi');
      setIsReadOnly(true);
      onBoosterTypeSelected();
      // Refresh stock after save
      await fetchStockAvailability();
    } catch (error: any) {
      console.error('Error saving booster type:', error);
      showToast.error(error.message || 'Gagal menyimpan jenis booster');
    } finally {
      setSaving(false);
    }
  };

  const renderStockInfo = (type: 'HHO' | 'NO2') => {
    if (!stockAvailability) return null;
    
    const stock = stockAvailability[type];
    const displayName = type === 'HHO' ? 'Gassotraus (HHO)' : 'Nitric Oxide (NO₂)';
    
    return (
      <div style={{ marginTop: '8px', fontSize: '12px' }}>
        <div style={{ 
          color: stock.available ? 'var(--color-success)' : 'var(--color-error)',
          fontWeight: '500'
        }}>
          Stok: {stock.stock} {stock.unit}
        </div>
        {stock.isLowStock && stock.available && (
          <div style={{ color: 'var(--color-warning)', marginTop: '2px' }}>
            ⚠️ Stok rendah (min: {stock.minThreshold})
          </div>
        )}
        {!stock.available && (
          <div style={{ color: 'var(--color-error)', marginTop: '2px' }}>
            ❌ Stok habis
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
        🚀 Pilih Jenis Booster
      </h3>

      <div style={{ 
        background: 'var(--color-surface)', 
        padding: '24px', 
        borderRadius: '12px',
        maxWidth: '600px'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Jenis Booster <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          
          {loadingStock && (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: '14px'
            }}>
              Memuat ketersediaan stok...
            </div>
          )}

          {isReadOnly ? (
            <div style={{
              padding: '12px 16px',
              background: 'var(--color-background)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              fontSize: '14px'
            }}>
              {boosterType === 'NO2' ? 'Nitric Oxide (NO₂)' : 'Gassotraus (HHO)'}
              {stockAvailability && renderStockInfo(boosterType as 'HHO' | 'NO2')}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{
                flex: 1,
                padding: '16px',
                border: `2px solid ${boosterType === 'NO2' ? 'var(--color-primary-400)' : 'var(--color-border)'}`,
                borderRadius: '8px',
                cursor: stockAvailability?.NO2?.available !== false ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                background: boosterType === 'NO2' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                opacity: stockAvailability?.NO2?.available === false ? 0.5 : 1
              }}>
                <input
                  type="radio"
                  name="boosterType"
                  value="NO2"
                  checked={boosterType === 'NO2'}
                  onChange={(e) => setBoosterType(e.target.value)}
                  disabled={stockAvailability?.NO2?.available === false}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  Nitric Oxide (NO₂)
                </span>
                {stockAvailability && renderStockInfo('NO2')}
              </label>

              <label style={{
                flex: 1,
                padding: '16px',
                border: `2px solid ${boosterType === 'HHO' ? 'var(--color-primary-400)' : 'var(--color-border)'}`,
                borderRadius: '8px',
                cursor: stockAvailability?.HHO?.available !== false ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                background: boosterType === 'HHO' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                opacity: stockAvailability?.HHO?.available === false ? 0.5 : 1
              }}>
                <input
                  type="radio"
                  name="boosterType"
                  value="HHO"
                  checked={boosterType === 'HHO'}
                  onChange={(e) => setBoosterType(e.target.value)}
                  disabled={stockAvailability?.HHO?.available === false}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  Gassotraus (HHO)
                </span>
                {stockAvailability && renderStockInfo('HHO')}
              </label>
            </div>
          )}
        </div>

        {!isReadOnly && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave}
              disabled={saving || !boosterType || loadingStock || (stockAvailability && !stockAvailability[boosterType as keyof StockAvailability]?.available) || false}
              className="btn btn-primary"
              style={{ minWidth: '120px' }}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        )}

        {isReadOnly && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-success)'
          }}>
            ✓ Jenis booster sudah dipilih dan stok telah dikurangi
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && stockAvailability && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--color-surface)',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
              Konfirmasi Pilihan Booster
            </h4>
            <p style={{ marginBottom: '16px', fontSize: '14px', lineHeight: '1.5' }}>
              Anda akan memilih <strong>{boosterType === 'HHO' ? 'Gassotraus (HHO)' : 'Nitric Oxide (NO₂)'}</strong>.
              <br />
              Stok akan dikurangi 1 unit dari {stockAvailability[boosterType as keyof StockAvailability].stock} yang tersedia.
              <br />
              <br />
              <em>Pilihan ini tidak dapat diubah setelah disimpan.</em>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="btn btn-secondary"
                style={{ minWidth: '80px' }}
              >
                Batal
              </button>
              <button
                onClick={confirmSave}
                className="btn btn-primary"
                style={{ minWidth: '80px' }}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
