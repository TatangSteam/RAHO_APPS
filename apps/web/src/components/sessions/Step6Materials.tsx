'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { showToast } from '@/lib/toast';
import { inventoryApi, type InventoryItemWithStock } from '@/lib/api/inventoryApi';
import {
  materialsApi,
  type MaterialDeviationReason,
  type MaterialRecommendation,
  type MaterialRecommendationsResponse,
} from '@/lib/materialsApi';
import { devError } from '@/lib/logger';
import { getApiErrorMessage } from '@/lib/api';
import { AlertTriangle, ClipboardCheck, Trash2 } from 'lucide-react';
import type { SessionMaterial } from '@/types/session';
import { useSessionWorkflowDraft } from './SessionWorkflowDraftContext';

type MaterialEntryDraft = {
  inventoryItemId?: string;
  quantity: string;
  searchTerm: string;
  deviationReason: MaterialDeviationReason | '';
  deviationNotes: string;
};

interface Step6MaterialsProps {
  sessionId: string;
  branchId: string;
  materials: SessionMaterial[];
  isLocked: boolean;
  onComplete: () => void;
}

// Helper: Categorize material based on name
function categorizeMaterial(name: string): { category: string; icon: string; order: number } {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('ifa') || lowerName.includes('a+mg')) {
    return { category: 'Cairan Infus Utama', icon: '💧', order: 1 };
  }
  if (
    lowerName.includes('hho') ||
    lowerName.includes('h2 ') ||
    lowerName.includes('hydrogen') ||
    lowerName.includes('no ') ||
    lowerName.includes('nitric') ||
    lowerName.includes('o2') ||
    lowerName.includes('o3') ||
    lowerName.includes('ozone') ||
    lowerName.includes('oxygen') ||
    lowerName.includes('gaso') ||
    lowerName.includes('edta') ||
    lowerName.includes('mb ') ||
    lowerName.includes('methylene') ||
    lowerName.includes('h2s') ||
    lowerName.includes('kcl') ||
    lowerName.includes('koktail') ||
    lowerName.includes('jml') ||
    lowerName.includes('nb ')
  ) {
    return { category: 'Booster & Tambahan', icon: '⚡', order: 2 };
  }
  if (
    lowerName.includes('infus set') ||
    lowerName.includes('jarum') ||
    lowerName.includes('syringe') ||
    lowerName.includes('tourniquet') ||
    lowerName.includes('oximeter') ||
    lowerName.includes('tensi') ||
    lowerName.includes('safety box')
  ) {
    return { category: 'Alat Medis', icon: '🩺', order: 3 };
  }
  if (
    lowerName.includes('handscoon') ||
    lowerName.includes('swab') ||
    lowerName.includes('alkohol') ||
    lowerName.includes('plester') ||
    lowerName.includes('plestrin') ||
    lowerName.includes('kapas') ||
    lowerName.includes('kantong') ||
    lowerName.includes('baterai')
  ) {
    return { category: 'Bahan Habis Pakai', icon: '📦', order: 4 };
  }

  return { category: 'Lainnya', icon: '📋', order: 5 };
}

// Helper: Get stock status color and label
function getStockStatus(stock: number, minThreshold: number) {
  if (stock <= 0) {
    return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Habis', icon: '🔴' };
  }
  if (stock <= minThreshold) {
    return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Stok Rendah', icon: '🟡' };
  }
  return { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Tersedia', icon: '🟢' };
}

export default function Step6Materials({
  sessionId,
  branchId,
  materials,
  isLocked,
  onComplete,
}: Step6MaterialsProps) {
  const materialDraft = useSessionWorkflowDraft<MaterialEntryDraft>('materials');
  const [loading, setLoading] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemWithStock[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItemWithStock | null>(null);
  const [quantity, setQuantity] = useState(materialDraft.initialDraft.quantity || '');
  const [searchTerm, setSearchTerm] = useState(materialDraft.initialDraft.searchTerm || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<MaterialRecommendationsResponse | null>(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [deviationReason, setDeviationReason] = useState<MaterialDeviationReason | ''>(materialDraft.initialDraft.deviationReason || '');
  const [deviationNotes, setDeviationNotes] = useState(materialDraft.initialDraft.deviationNotes || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadInventoryItems = useCallback(async () => {
    try {
      setLoadingInventory(true);
      if (!branchId) {
        showToast.error('Branch ID tidak ditemukan');
        return;
      }
      const response = await inventoryApi.getAvailableItems(branchId);
      // API returns { success: true, data: items }, so we need response.data.data
      setInventoryItems(response.data?.data || response.data || []);
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading inventory:', error);
      showToast.error('Gagal memuat data inventory');
    } finally {
      setLoadingInventory(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadInventoryItems();
  }, [loadInventoryItems]);

  useEffect(() => {
    if (!materialDraft.initialDraft.inventoryItemId || selectedItem || inventoryItems.length === 0) return;
    const restored = inventoryItems.find((item) => item.id === materialDraft.initialDraft.inventoryItemId);
    if (restored) setSelectedItem(restored);
  }, [inventoryItems, selectedItem]);

  useEffect(() => {
    materialDraft.updateDraft({
      inventoryItemId: selectedItem?.id,
      quantity,
      searchTerm,
      deviationReason,
      deviationNotes,
    });
  }, [deviationNotes, deviationReason, quantity, searchTerm, selectedItem?.id]);

  const loadRecommendations = useCallback(async () => {
    try {
      setLoadingRecommendations(true);
      setRecommendations(await materialsApi.getRecommendations(sessionId));
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading treatment BOM recommendations:', error);
      setRecommendations(null);
    } finally {
      setLoadingRecommendations(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const selectedRecommendation = useMemo(
    () => recommendations?.items.find(
      (item) => item.inventoryItemId === selectedItem?.id || item.masterProductId === selectedItem?.masterProductId,
    ) ?? null,
    [recommendations, selectedItem],
  );

  const isDeviation = useMemo(() => {
    if (!selectedItem || !quantity || !recommendations?.hasActiveBom) return false;
    if (!selectedRecommendation) return true;
    const recommended = Number(selectedRecommendation.recommendedQuantity);
    const tolerance = recommended * Number(selectedRecommendation.tolerancePercent) / 100;
    const actual = Number(quantity);
    return actual < recommended - tolerance || actual > recommended + tolerance;
  }, [quantity, recommendations?.hasActiveBom, selectedItem, selectedRecommendation]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddMaterial = async () => {
    if (!selectedItem || !quantity || Number(quantity) <= 0) {
      showToast.error('Pilih item dan masukkan jumlah yang valid');
      return;
    }

    if (isDeviation && !deviationReason) {
      showToast.error('Pilih alasan deviasi dari Treatment BOM');
      return;
    }

    if (deviationReason === 'OTHER' && !deviationNotes.trim()) {
      showToast.error('Catatan wajib diisi untuk alasan Lainnya');
      return;
    }

    setLoading(true);

    try {
      await materialsApi.createMaterial(sessionId, {
        inventoryItemId: selectedItem.id,
        quantity: Number(quantity),
        unit: selectedItem.masterProduct.usageUnit,
        deviationReason: deviationReason || undefined,
        deviationNotes: deviationNotes.trim() || undefined,
      });

      showToast.success('Material aktual berhasil disimpan sebagai draft');
      setSelectedItem(null);
      setQuantity('');
      setSearchTerm('');
      setDeviationReason('');
      setDeviationNotes('');
      materialDraft.clearDraft();
      onComplete();
    } catch (error: unknown) {
      devError('Error adding material:', error);
      showToast.error(getApiErrorMessage(error) || 'Gagal menambah material');
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = (recommendation: MaterialRecommendation) => {
    const item = inventoryItems.find((inventoryItem) => inventoryItem.id === recommendation.inventoryItemId);
    if (!item) {
      showToast.error('Material rekomendasi belum tersedia pada inventory cabang');
      return;
    }
    setSelectedItem(item);
    setQuantity(recommendation.recommendedQuantity);
    setDeviationReason('');
    setDeviationNotes('');
  };

  const handleDeleteMaterial = async (usageId: string) => {
    try {
      await materialsApi.deleteMaterial(sessionId, usageId);
      showToast.success('Draft material dihapus');
      onComplete();
    } catch (error: unknown) {
      devError('Error deleting material usage:', error);
      showToast.error(getApiErrorMessage(error) || 'Gagal menghapus draft material');
    }
  };

  // Group items by category and apply search filter
  const groupedItems = useMemo(() => {
    const filtered = inventoryItems.filter((item) =>
      item.masterProduct.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, { icon: string; order: number; items: InventoryItemWithStock[] }> =
      {};

    filtered.forEach((item) => {
      const { category, icon, order } = categorizeMaterial(item.masterProduct.name);
      if (!groups[category]) {
        groups[category] = { icon, order, items: [] };
      }
      groups[category].items.push(item);
    });

    // Sort categories by order, items by name within category
    return Object.entries(groups)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([name, data]) => ({
        name,
        icon: data.icon,
        items: data.items.sort((a, b) =>
          a.masterProduct.name.localeCompare(b.masterProduct.name)
        ),
      }));
  }, [inventoryItems, searchTerm]);

  const totalFiltered = groupedItems.reduce((sum, g) => sum + g.items.length, 0);

  if (isLocked) {
    return (
      <div
        className="material-add-card"
        style={{
          padding: '24px',
          background: 'rgba(148,163,184,0.05)',
          border: '2px solid rgba(148,163,184,0.2)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(148,163,184,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontWeight: '700',
              fontSize: '20px',
            }}
          >
            6
          </div>
          <div>
            <h3
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#94a3b8',
                marginBottom: '4px',
              }}
            >
              📦 Material Usage
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Step sebelumnya harus diselesaikan terlebih dahulu
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasCompletedMaterials = materials.length > 0;

  return (
    <div
      style={{
        padding: '24px',
        background: hasCompletedMaterials
          ? 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(22,163,74,0.05))'
          : 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(147,51,234,0.05))',
        border: hasCompletedMaterials
          ? '2px solid rgba(34,197,94,0.3)'
          : '2px solid rgba(59,130,246,0.3)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: hasCompletedMaterials
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '700',
            fontSize: '20px',
            boxShadow: hasCompletedMaterials
              ? '0 4px 12px rgba(34,197,94,0.3)'
              : '0 4px 12px rgba(59,130,246,0.3)',
          }}
        >
          {hasCompletedMaterials ? '✓' : '6'}
        </div>
        <div>
          <h3
            style={{
              fontSize: '20px',
              fontWeight: '700',
              marginBottom: '4px',
              color: '#f1f5f9',
            }}
          >
            📦 Material Usage
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Catat material yang digunakan dalam sesi ini
          </p>
        </div>
      </div>

      {/* Treatment BOM recommendations */}
      <div
        style={{
          marginBottom: '24px',
          borderTop: '1px solid rgba(148,163,184,0.2)',
          borderBottom: '1px solid rgba(148,163,184,0.2)',
        }}
      >
        <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardCheck size={17} color="#60a5fa" />
          <strong style={{ fontSize: '14px', color: '#cbd5e1' }}>Rekomendasi Treatment BOM</strong>
          {recommendations?.boms.map((bom) => (
            <span
              key={bom.id}
              style={{
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(59,130,246,0.12)',
                color: '#93c5fd',
                fontSize: '11px',
              }}
            >
              {bom.bomCode}
            </span>
          ))}
          {recommendations?.kits.map((kit) => (
            <span
              key={kit.id}
              style={{
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(34,197,94,0.12)',
                color: '#86efac',
                fontSize: '11px',
              }}
            >
              {kit.name}
            </span>
          ))}
        </div>

        {loadingRecommendations ? (
          <p style={{ padding: '0 0 12px', fontSize: '13px', color: '#94a3b8' }}>Memuat rekomendasi...</p>
        ) : recommendations?.hasActiveBom ? (
          <div style={{ display: 'grid' }}>
            {recommendations.items.map((recommendation) => {
              const recorded = materials.some(
                (material) => material.inventoryItem.masterProduct.id === recommendation.masterProductId,
              );
              return (
                <div
                  key={recommendation.masterProductId}
                  style={{
                    minHeight: '48px',
                    padding: '9px 0',
                    borderTop: '1px solid rgba(148,163,184,0.1)',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 1fr) 120px 140px',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>{recommendation.productName}</p>
                    <p style={{ color: '#64748b', fontSize: '11px' }}>
                      {recommendation.isRequired ? 'Wajib' : 'Opsional'} · toleransi {Number(recommendation.tolerancePercent).toFixed(0)}%
                    </p>
                  </div>
                  <span style={{ color: '#bfdbfe', fontSize: '13px', fontWeight: 700 }}>
                    {Number(recommendation.recommendedQuantity).toFixed(2)} {recommendation.unit}
                  </span>
                  <button
                    type="button"
                    onClick={() => applyRecommendation(recommendation)}
                    disabled={!recommendation.isAvailable || recorded}
                    style={{
                      minHeight: '32px',
                      border: '1px solid rgba(96,165,250,0.35)',
                      borderRadius: '5px',
                      background: recorded ? 'rgba(34,197,94,0.1)' : 'transparent',
                      color: recorded ? '#86efac' : '#93c5fd',
                      cursor: !recommendation.isAvailable || recorded ? 'not-allowed' : 'pointer',
                      opacity: !recommendation.isAvailable && !recorded ? 0.5 : 1,
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {recorded
                      ? 'Sudah dicatat'
                      : recommendation.isAvailable
                        ? 'Gunakan'
                        : 'Stok tidak tersedia'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ padding: '0 0 12px', fontSize: '13px', color: '#94a3b8' }}>
            Belum ada Treatment BOM aktif untuk paket sesi ini.
          </p>
        )}
      </div>

      {/* Existing Materials */}
      {materials.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4
            style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#cbd5e1',
              marginBottom: '12px',
            }}
          >
            Material yang Digunakan ({materials.length}):
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {materials.map((material) => {
              const cat = categorizeMaterial(material.inventoryItem.masterProduct.name);
              return (
                <div
                  key={material.id}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(148,163,184,0.08)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{cat.icon}</span>
                    <div>
                      <p
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#f1f5f9',
                          marginBottom: '2px',
                        }}
                      >
                        {material.inventoryItem.masterProduct.name}
                      </p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>{cat.category}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '16px', fontWeight: '700', color: '#60a5fa' }}>
                        {material.quantity}{' '}
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{material.unit}</span>
                      </p>
                      <p style={{ fontSize: '11px', color: material.status === 'CONSUMED' ? '#86efac' : '#fbbf24' }}>
                        {material.status === 'CONSUMED' ? 'Stok terpakai' : 'Draft'}
                        {material.totalActualCost != null && Number(material.totalActualCost) > 0
                          ? ` · Rp ${Number(material.totalActualCost).toLocaleString('id-ID')}`
                          : ''}
                      </p>
                      {material.deviationReason && (
                        <p style={{ fontSize: '11px', color: '#fca5a5' }}>
                          Deviasi: {material.deviationReason.replaceAll('_', ' ')}
                        </p>
                      )}
                    </div>
                    {material.status !== 'CONSUMED' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(material.id)}
                        title="Hapus draft material"
                        aria-label={`Hapus ${material.inventoryItem.masterProduct.name}`}
                        style={{
                          width: '32px',
                          height: '32px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(248,113,113,0.35)',
                          borderRadius: '5px',
                          background: 'transparent',
                          color: '#fca5a5',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Material Form */}
      <div
        style={{
          padding: '20px',
          background: 'rgba(15,23,42,0.5)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <h4
          style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#cbd5e1',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>➕</span> Tambah Material
        </h4>

        <div
          className="material-add-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: '12px', alignItems: 'end' }}
        >
          {/* Custom Dropdown with Search */}
          <div ref={dropdownRef} className="material-picker-field" style={{ position: 'relative' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#cbd5e1',
                marginBottom: '8px',
              }}
            >
              Pilih Material
            </label>

            {/* Selected/Search Input */}
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={loading || loadingInventory}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(15,23,42,0.7)',
                border: `1px solid ${isDropdownOpen ? '#3b82f6' : 'rgba(148,163,184,0.3)'}`,
                borderRadius: 'var(--radius-md)',
                color: '#f1f5f9',
                fontSize: '14px',
                cursor: loading || loadingInventory ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'left',
                transition: 'border-color 0.2s',
              }}
            >
              {selectedItem ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '18px' }}>
                    {categorizeMaterial(selectedItem.masterProduct.name).icon}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedItem.masterProduct.name}
                  </span>
                </div>
              ) : (
                <span style={{ color: '#64748b' }}>
                  {loadingInventory
                    ? '⏳ Memuat material...'
                    : inventoryItems.length === 0
                    ? '⚠️ Tidak ada material tersedia'
                    : '🔍 Pilih atau cari material...'}
                </span>
              )}
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                {isDropdownOpen ? '▲' : '▼'}
              </span>
            </button>

            {/* Dropdown Panel */}
            {isDropdownOpen && (
              <div
                className="material-picker-dropdown"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: '#0f172a',
                  border: '1px solid rgba(148,163,184,0.3)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  maxHeight: '420px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Search Box */}
                <div
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid rgba(148,163,184,0.2)',
                  }}
                >
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="🔍 Cari material..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(148,163,184,0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#f1f5f9',
                      fontSize: '14px',
                    }}
                  />
                  {searchTerm && (
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '6px',
                      }}
                    >
                      Ditemukan {totalFiltered} material
                    </p>
                  )}
                </div>

                {/* Grouped Items */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {totalFiltered === 0 ? (
                    <div
                      style={{
                        padding: '32px 16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '14px',
                      }}
                    >
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                      Tidak ada material yang cocok
                    </div>
                  ) : (
                    groupedItems.map((group) => (
                      <div key={group.name}>
                        {/* Category Header */}
                        <div
                          style={{
                            padding: '10px 16px',
                            background: 'rgba(59,130,246,0.1)',
                            borderBottom: '1px solid rgba(148,163,184,0.1)',
                            position: 'sticky',
                            top: 0,
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          <span style={{ fontSize: '16px' }}>{group.icon}</span>
                          <span>{group.name}</span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              padding: '2px 8px',
                              background: 'rgba(59,130,246,0.2)',
                              borderRadius: '12px',
                              color: '#60a5fa',
                            }}
                          >
                            {group.items.length}
                          </span>
                        </div>

                        {/* Items */}
                        {group.items.map((item) => {
                          const stock = Number(item.stockInfo?.usageStock ?? 0);
                          const minThreshold = Number(
                            item.stockInfo?.minThresholdUsage ?? 0
                          );
                          const status = getStockStatus(stock, minThreshold);
                          const isSelected = selectedItem?.id === item.id;
                          const isOutOfStock = stock <= 0;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                if (!isOutOfStock) {
                                  setSelectedItem(item);
                                  setQuantity('');
                                  setDeviationReason('');
                                  setDeviationNotes('');
                                  setIsDropdownOpen(false);
                                  setSearchTerm('');
                                }
                              }}
                              disabled={isOutOfStock}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: isSelected
                                  ? 'rgba(59,130,246,0.15)'
                                  : 'transparent',
                                border: 'none',
                                borderBottom: '1px solid rgba(148,163,184,0.08)',
                                color: '#f1f5f9',
                                fontSize: '14px',
                                cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                opacity: isOutOfStock ? 0.5 : 1,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '12px',
                                transition: 'background 0.15s',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                if (!isOutOfStock && !isSelected) {
                                  e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'transparent';
                                }
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#f1f5f9',
                                    marginBottom: '4px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.masterProduct.name}
                                </p>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12px',
                                  }}
                                >
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      background: status.bg,
                                      color: status.color,
                                      borderRadius: '4px',
                                      fontWeight: '600',
                                    }}
                                  >
                                    {status.icon} {stock.toFixed(0)}{' '}
                                    {item.masterProduct.usageUnit}
                                  </span>
                                  {item.stockInfo?.baseStock != null && (
                                    <span style={{ color: '#64748b' }}>
                                      ({Number(item.stockInfo.baseStock).toFixed(2)}{' '}
                                      {item.masterProduct.baseUnit})
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <span
                                  style={{
                                    color: '#3b82f6',
                                    fontSize: '18px',
                                    fontWeight: '700',
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#cbd5e1',
                marginBottom: '8px',
              }}
            >
              Jumlah {selectedItem && `(${selectedItem.masterProduct.usageUnit})`}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f1f5f9',
                fontSize: '14px',
              }}
              disabled={loading || !selectedItem}
            />
          </div>

          {/* Add Button */}
          <button
            className="material-add-button"
            onClick={handleAddMaterial}
            disabled={loading || !selectedItem || !quantity}
            style={{
              padding: '12px 24px',
              background:
                loading || !selectedItem || !quantity
                  ? 'rgba(59,130,246,0.3)'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || !selectedItem || !quantity ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Menambah...' : '➕ Tambah'}
          </button>
        </div>

        {isDeviation && (
          <div
            className="material-deviation-grid"
            style={{
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(245,158,11,0.25)',
              display: 'grid',
              gridTemplateColumns: '220px minmax(220px, 1fr)',
              gap: '12px',
            }}
          >
            <div>
              <label
                htmlFor="material-deviation-reason"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#fbbf24', marginBottom: '7px' }}
              >
                <AlertTriangle size={14} /> Alasan deviasi
              </label>
              <select
                id="material-deviation-reason"
                value={deviationReason}
                onChange={(event) => setDeviationReason(event.target.value as MaterialDeviationReason | '')}
                style={{
                  width: '100%',
                  minHeight: '40px',
                  padding: '8px 10px',
                  border: '1px solid rgba(245,158,11,0.35)',
                  borderRadius: '5px',
                  background: '#0f172a',
                  color: '#f1f5f9',
                }}
                required
              >
                <option value="">Pilih alasan</option>
                <option value="CLINICAL_ADJUSTMENT">Penyesuaian klinis</option>
                <option value="PATIENT_CONDITION">Kondisi pasien</option>
                <option value="MATERIAL_SUBSTITUTION">Substitusi material</option>
                <option value="WASTE_DAMAGE">Waste atau kerusakan</option>
                <option value="STOCK_AVAILABILITY">Ketersediaan stok</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>
            <div>
              <label htmlFor="material-deviation-notes" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '7px' }}>
                Catatan deviasi {deviationReason === 'OTHER' ? '*' : ''}
              </label>
              <input
                id="material-deviation-notes"
                type="text"
                value={deviationNotes}
                onChange={(event) => setDeviationNotes(event.target.value)}
                maxLength={2000}
                placeholder="Catatan klinis atau operasional"
                style={{
                  width: '100%',
                  minHeight: '40px',
                  padding: '8px 10px',
                  border: '1px solid rgba(148,163,184,0.3)',
                  borderRadius: '5px',
                  background: '#0f172a',
                  color: '#f1f5f9',
                }}
              />
            </div>
          </div>
        )}

        {/* Selected Item Info */}
        {selectedItem && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>ℹ️</span>
            <span>
              Stok tersedia:{' '}
              <strong style={{ color: '#60a5fa' }}>
                {Number(selectedItem.stockInfo?.usageStock ?? 0).toFixed(0)}{' '}
                {selectedItem.masterProduct.usageUnit}
              </strong>
            </span>
          </div>
        )}
      </div>

      {hasCompletedMaterials && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: 'var(--color-success)',
          }}
        >
          ✓ Material usage telah dicatat. Anda dapat menambah material lain atau klik save untuk
          melanjutkan.
        </div>
      )}
    </div>
  );
}
