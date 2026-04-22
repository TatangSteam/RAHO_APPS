'use client';

import { useState, useEffect } from 'react';
import { packagesApi } from '@/lib/packagesApi';
import type { PackagePricing } from '@/types/package';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';

export default function PackagePricingPage() {
  const { user } = useAuthStore();
  const [pricings, setPricings] = useState<PackagePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    packageType: 'BASIC' as 'BASIC' | 'BOOSTER',
    name: '',
    totalSessions: 1,
    price: 0,
    isActive: true
  });

  const isAdminCabang = user?.role === 'ADMIN_CABANG';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = isAdminCabang || isSuperAdmin;

  useEffect(() => {
    loadPricings();
  }, []);

  const loadPricings = async () => {
    try {
      setLoading(true);
      const data = await packagesApi.getPackagePricings();
      setPricings(data.pricings || []);
    } catch (error) {
      console.error('Failed to load pricings:', error);
      showToast.error('Gagal memuat data harga paket');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.totalSessions < 1 || formData.price < 0) {
      showToast.error('Mohon lengkapi semua field dengan benar');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await packagesApi.updatePackagePricing(editingId, formData);
        showToast.success('Harga paket berhasil diupdate');
      } else {
        await packagesApi.createPackagePricing(formData);
        showToast.success('Harga paket berhasil ditambahkan');
      }
      setShowModal(false);
      resetForm();
      loadPricings();
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Gagal menyimpan harga paket';
      showToast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (pricing: PackagePricing) => {
    setEditingId(pricing.id);
    setFormData({
      packageType: pricing.packageType,
      name: pricing.name,
      totalSessions: pricing.totalSessions,
      price: pricing.price,
      isActive: pricing.isActive
    });
    setShowModal(true);
  };

  const handleToggleActive = async (pricing: PackagePricing) => {
    try {
      await packagesApi.updatePackagePricing(pricing.id, {
        isActive: !pricing.isActive
      });
      showToast.success(`Harga paket berhasil ${!pricing.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      loadPricings();
    } catch (error) {
      showToast.error('Gagal mengubah status harga paket');
    }
  };

  const handleDelete = async (pricingId: string) => {
    if (!confirm('Yakin ingin menghapus harga paket ini?')) return;

    try {
      await packagesApi.deletePackagePricing(pricingId);
      showToast.success('Harga paket berhasil dihapus');
      loadPricings();
    } catch (error) {
      showToast.error('Gagal menghapus harga paket');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      packageType: 'BASIC',
      name: '',
      totalSessions: 1,
      price: 0,
      isActive: true
    });
  };

  // Group pricings by branch for display
  const groupedByBranch = pricings.reduce((acc, pricing) => {
    const branchKey = pricing.branchId;
    if (!acc[branchKey]) {
      acc[branchKey] = {
        branchCode: pricing.branchCode || '',
        branchName: pricing.branchName || '',
        pricings: []
      };
    }
    acc[branchKey].pricings.push(pricing);
    return acc;
  }, {} as Record<string, { branchCode: string; branchName: string; pricings: PackagePricing[] }>);

  if (!canManage) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Akses Ditolak</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Anda tidak memiliki akses ke halaman ini</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>💰 Kelola Harga Paket</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {isAdminCabang ? 'Atur harga paket terapi untuk cabang Anda' : 'Kelola harga paket terapi'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="btn btn-primary"
            >
              ➕ Tambah Harga Paket
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Memuat data...</p>
        </div>
      ) : pricings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📦</div>
          <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Belum ada harga paket
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Klik tombol "Tambah Harga Paket" untuk menambahkan harga paket baru
          </p>
        </div>
      ) : (
        <>
          {Object.entries(groupedByBranch).map(([branchId, branchData]) => (
            <div key={branchId} style={{ marginBottom: '24px' }}>
              {branchData.branchCode && (
                <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    🏢 {branchData.branchName} ({branchData.branchCode})
                  </h3>
                </div>
              )}
              <div className="card">
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Tipe</th>
                        <th>Nama Paket</th>
                        <th>Jumlah Sesi</th>
                        <th>Harga</th>
                        <th>Status</th>
                        {canManage && <th style={{ textAlign: 'right' }}>Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {branchData.pricings.map((pricing) => (
                        <tr key={pricing.id}>
                          <td>
                            <span className={`badge ${pricing.packageType === 'BASIC' ? 'badge-blue' : 'badge-purple'}`}>
                              {pricing.packageType === 'BASIC' ? '📦 BASIC' : '🚀 BOOSTER'}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600' }}>{pricing.name}</td>
                          <td>{pricing.totalSessions} sesi</td>
                          <td style={{ fontWeight: '600', color: 'var(--color-primary-500)' }}>
                            Rp {pricing.price.toLocaleString('id-ID')}
                          </td>
                          <td>
                            <span className={`badge ${pricing.isActive ? 'badge-green' : 'badge-gray'}`}>
                              {pricing.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                            </span>
                          </td>
                          {canManage && (
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => handleEdit(pricing)}
                                  className="btn btn-sm btn-secondary"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleToggleActive(pricing)}
                                  className={`btn btn-sm ${pricing.isActive ? 'btn-secondary' : 'btn-primary'}`}
                                  title={pricing.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                >
                                  {pricing.isActive ? '🔒' : '🔓'}
                                </button>
                                <button
                                  onClick={() => handleDelete(pricing.id)}
                                  className="btn btn-sm btn-secondary"
                                  title="Hapus"
                                  style={{ color: '#ef4444' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Modal Add/Edit */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            setShowModal(false);
            resetForm();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: '100%',
              maxWidth: '500px',
              margin: '24px',
              animation: 'fadeIn 0.2s',
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto'
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>
              {editingId ? '✏️ Edit Harga Paket' : '➕ Tambah Harga Paket'}
            </h3>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Tipe Paket</label>
              <select
                value={formData.packageType}
                onChange={(e) => setFormData({ ...formData, packageType: e.target.value as 'BASIC' | 'BOOSTER' })}
                className="form-input"
                disabled={!!editingId}
              >
                <option value="BASIC">📦 BASIC</option>
                <option value="BOOSTER">🚀 BOOSTER</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Nama Paket</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="Contoh: Basic 7 Sesi"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Jumlah Sesi</label>
              <input
                type="number"
                value={formData.totalSessions}
                onChange={(e) => setFormData({ ...formData, totalSessions: parseInt(e.target.value) || 0 })}
                className="form-input"
                min="1"
                disabled={!!editingId}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Harga (Rp)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                className="form-input"
                min="0"
                step="100000"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                <span>Aktif</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {submitting ? '⏳ Menyimpan...' : editingId ? '💾 Update' : '➕ Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
