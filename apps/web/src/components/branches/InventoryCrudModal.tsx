'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Hash, Tag, MapPin, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { api } from '@/lib/api';
import styles from '@/styles/crud-modal.module.css';

interface InventoryCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'create' | 'edit' | 'delete';
  branchId: string;
  inventoryData?: any;
}

interface InventoryFormData {
  name: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  stock: number;
  usageStock: number;
  minThreshold: number;
  minThresholdUsage: number;
  storageLocation: string;
  conversionFactor: number;
}

const CATEGORY_OPTIONS = [
  'INFUSION_MATERIAL',
  'MEDICAL_EQUIPMENT',
  'CONSUMABLES',
  'MEDICATION',
  'SUPPLEMENTS',
  'OTHER'
];

const UNIT_OPTIONS = [
  'PCS',
  'BOX',
  'BOTTLE',
  'VIAL',
  'AMPUL',
  'TABLET',
  'CAPSULE',
  'ML',
  'LITER',
  'GRAM',
  'KG'
];

export default function InventoryCrudModal({
  isOpen,
  onClose,
  onSuccess,
  action,
  branchId,
  inventoryData
}: InventoryCrudModalProps) {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState<InventoryFormData>({
    name: '',
    category: 'INFUSION_MATERIAL',
    baseUnit: 'PCS',
    usageUnit: 'PCS',
    stock: 0,
    usageStock: 0,
    minThreshold: 10,
    minThresholdUsage: 10,
    storageLocation: '',
    conversionFactor: 1
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (action === 'edit' && inventoryData) {
      setFormData({
        name: inventoryData.name || '',
        category: inventoryData.category || 'INFUSION_MATERIAL',
        baseUnit: inventoryData.baseUnit || 'PCS',
        usageUnit: inventoryData.usageUnit || 'PCS',
        stock: inventoryData.stock || 0,
        usageStock: inventoryData.usageStock || 0,
        minThreshold: inventoryData.minThreshold || 10,
        minThresholdUsage: inventoryData.minThresholdUsage || 10,
        storageLocation: inventoryData.storageLocation || '',
        conversionFactor: inventoryData.conversionFactor || 1
      });
    }
  }, [action, inventoryData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (action === 'create') {
        // Create inventory item
        const createData = {
          ...formData,
          branchId: branchId
        };
        
        await api.post('/inventory/items', createData);
        showToast.success('Item inventori berhasil ditambahkan');
      } else if (action === 'edit') {
        // Update inventory item
        await api.patch(`/inventory/items/${inventoryData.id}`, formData);
        showToast.success('Item inventori berhasil diperbarui');
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('Error saving inventory item:', error);
      showToast.error(error.response?.data?.message || `Gagal ${action === 'create' ? 'menambahkan' : 'memperbarui'} item inventori`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div 
      className={styles.modalOverlay} 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)'
      }}
    >
      <div 
        className={styles.modalContent} 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 10000,
          maxWidth: '600px',
          width: '100%'
        }}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Package size={24} />
            <h2>{action === 'create' ? 'Tambah Item Inventori' : 'Edit Item Inventori'}</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroupFull}>
              <label htmlFor="name">
                <Package size={16} />
                Nama Item *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Masukkan nama item"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="category">
                <Tag size={16} />
                Kategori *
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
              >
                {CATEGORY_OPTIONS.map(category => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="storageLocation">
                <MapPin size={16} />
                Lokasi Penyimpanan
              </label>
              <input
                type="text"
                id="storageLocation"
                name="storageLocation"
                value={formData.storageLocation}
                onChange={handleInputChange}
                placeholder="Rak A1, Lemari B2, dll"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="baseUnit">
                Satuan Dasar *
              </label>
              <select
                id="baseUnit"
                name="baseUnit"
                value={formData.baseUnit}
                onChange={handleInputChange}
                required
              >
                {UNIT_OPTIONS.map(unit => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="usageUnit">
                Satuan Pakai *
              </label>
              <select
                id="usageUnit"
                name="usageUnit"
                value={formData.usageUnit}
                onChange={handleInputChange}
                required
              >
                {UNIT_OPTIONS.map(unit => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="conversionFactor">
                <Hash size={16} />
                Faktor Konversi *
              </label>
              <input
                type="number"
                id="conversionFactor"
                name="conversionFactor"
                value={formData.conversionFactor}
                onChange={handleInputChange}
                required
                min="0.01"
                step="0.01"
                placeholder="1"
              />
              <small>1 {formData.baseUnit} = {formData.conversionFactor} {formData.usageUnit}</small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="stock">
                Stok Dasar
              </label>
              <input
                type="number"
                id="stock"
                name="stock"
                value={formData.stock}
                onChange={handleInputChange}
                min="0"
                placeholder="0"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="usageStock">
                Stok Pakai
              </label>
              <input
                type="number"
                id="usageStock"
                name="usageStock"
                value={formData.usageStock}
                onChange={handleInputChange}
                min="0"
                placeholder="0"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="minThreshold">
                <AlertTriangle size={16} />
                Min. Stok Dasar
              </label>
              <input
                type="number"
                id="minThreshold"
                name="minThreshold"
                value={formData.minThreshold}
                onChange={handleInputChange}
                min="0"
                placeholder="10"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="minThresholdUsage">
                <AlertTriangle size={16} />
                Min. Stok Pakai
              </label>
              <input
                type="number"
                id="minThresholdUsage"
                name="minThresholdUsage"
                value={formData.minThresholdUsage}
                onChange={handleInputChange}
                min="0"
                placeholder="10"
              />
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {action === 'create' ? 'Tambah Item' : 'Simpan Perubahan'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}