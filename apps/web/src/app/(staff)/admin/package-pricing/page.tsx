'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { formatCurrency } from '@/lib/formatNumber';
import styles from './page.module.css';

interface PackagePricing {
  id: string;
  packageType: 'BASIC' | 'BOOSTER';
  boosterType?: 'NO' | 'GT' | 'MB' | 'KCL' | 'H2S' | 'HK' | 'O3' | 'HHO' | 'NO2';
  serviceType?: string;
  name: string;
  productCode?: string;
  totalSessions: number;
  price: number;
  isActive: boolean;
  branchId: string | null;
  branch: {
    id: string;
    name: string;
    branchCode: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface NonTherapyProduct {
  id: string;
  productCode: string;
  productType: 'AIR_NANO' | 'ROKOK_KENKOU';
  name: string;
  description?: string;
  airNanoColor?: 'KUNING' | 'BIRU' | 'HIJAU';
  airNanoVolume?: 'ML_600' | 'ML_1500';
  airNanoUnit?: 'BOTOL' | 'DUS';
  pricePerUnit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MasterBoosterType {
  id: string;
  code: string;
  name: string;
  icon?: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface MasterServiceType {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function PackagePricingPage() {
  const { user, accessToken } = useAuthStore();
  const [pricings, setPricings] = useState<PackagePricing[]>([]);
  const [products, setProducts] = useState<NonTherapyProduct[]>([]);
  const [boosterTypes, setBoosterTypes] = useState<MasterBoosterType[]>([]);
  const [serviceTypes, setServiceTypes] = useState<MasterServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'packages' | 'addons' | 'master'>('packages');
  const [masterTab, setMasterTab] = useState<'booster' | 'service'>('booster');
  const [formData, setFormData] = useState({
    packageType: 'BASIC' as 'BASIC' | 'BOOSTER',
    boosterType: '' as '' | 'NO' | 'GT' | 'MB' | 'KCL' | 'H2S' | 'HK' | 'O3' | 'HHO' | 'NO2',
    serviceType: '' as '' | 'PM' | 'PS' | 'PTY' | 'PDA' | 'PHC',
    name: '',
    totalSessions: 7,
    price: 0,
    productCode: '',
    isActive: true
  });
  const [addonFormData, setAddonFormData] = useState({
    productCode: '',
    productType: 'AIR_NANO' as 'AIR_NANO' | 'ROKOK_KENKOU',
    name: '',
    description: '',
    pricePerUnit: 0,
    airNanoColor: '' as '' | 'KUNING' | 'BIRU' | 'HIJAU',
    airNanoVolume: '' as '' | 'ML_600' | 'ML_1500',
    airNanoUnit: '' as '' | 'BOTOL' | 'DUS',
    isActive: true
  });
  const [masterFormData, setMasterFormData] = useState({
    code: '',
    name: '',
    icon: '',
    description: '',
    sortOrder: 0,
    isActive: true
  });

  const isAdminCabang = user?.role === 'ADMIN_CABANG';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminManager = user?.role === 'ADMIN_MANAGER';
  const canManage = isAdminCabang || isSuperAdmin || isAdminManager;
  const canManageAddons = isSuperAdmin || isAdminManager; // Only SUPER_ADMIN and ADMIN_MANAGER can create/edit/delete add-ons

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
        if (activeTab === 'packages') {
          resetForm();
        } else {
          resetAddonForm();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showModal, activeTab]);

  useEffect(() => {
    if (user && accessToken) {
      if (activeTab === 'packages') {
        loadPricings();
      } else if (activeTab === 'addons') {
        loadProducts();
      } else if (activeTab === 'master') {
        loadMasterData();
      }
    }
  }, [user, accessToken, activeTab]);

  const loadPricings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Gagal memuat data harga paket');
      }

      const data = await response.json();
      console.log('📦 Package Pricing Data:', data.data?.pricings);
      setPricings(data.data?.pricings || []);
    } catch (error: any) {
      console.error('Failed to load pricings:', error);
      showToast.error(error.message || 'Gagal memuat data harga paket');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/non-therapy-products`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Gagal memuat data add-on');
      }

      const data = await response.json();
      console.log('✨ Add-on Products Data:', data.data?.products);
      setProducts(data.data?.products || []);
    } catch (error: any) {
      console.error('Failed to load products:', error);
      showToast.error(error.message || 'Gagal memuat data add-on');
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      setLoading(true);
      
      // Load booster types
      const boosterResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/booster-types`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (boosterResponse.ok) {
        const boosterData = await boosterResponse.json();
        setBoosterTypes(boosterData.data?.types || []);
      }

      // Load service types
      const serviceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/service-types`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (serviceResponse.ok) {
        const serviceData = await serviceResponse.json();
        setServiceTypes(serviceData.data?.types || []);
      }
    } catch (error: any) {
      console.error('Failed to load master data:', error);
      showToast.error(error.message || 'Gagal memuat data master');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.totalSessions < 1 || formData.price < 0) {
      showToast.error('Mohon lengkapi semua field dengan benar');
      return;
    }

    // Validate boosterType for BOOSTER packages
    if (formData.packageType === 'BOOSTER' && !formData.boosterType) {
      showToast.error('Tipe booster wajib diisi untuk paket BOOSTER');
      return;
    }

    // Validate serviceType for BOOSTER packages
    if (formData.packageType === 'BOOSTER' && !formData.serviceType) {
      showToast.error('Tipe layanan wajib diisi untuk paket BOOSTER');
      return;
    }

    try {
      setSubmitting(true);
      
      if (editingId) {
        // Update - only send price and isActive
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing/${editingId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price: formData.price,
            isActive: formData.isActive,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Gagal mengupdate harga paket');
        }

        showToast.success('Harga paket berhasil diupdate');
      } else {
        // Create
        const payload: any = {
          packageType: formData.packageType,
          name: formData.name,
          totalSessions: formData.totalSessions,
          price: formData.price,
          productCode: formData.productCode || undefined,
          isActive: formData.isActive,
        };

        // Add boosterType and serviceType for BOOSTER packages
        if (formData.packageType === 'BOOSTER') {
          if (formData.boosterType) payload.boosterType = formData.boosterType;
          if (formData.serviceType) payload.serviceType = formData.serviceType;
        }

        // Add branchId for ADMIN_CABANG
        if (isAdminCabang && user?.branchId) {
          payload.branchId = user.branchId;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Gagal menambahkan harga paket');
        }

        showToast.success('Harga paket berhasil ditambahkan');
      }
      
      setShowModal(false);
      resetForm();
      loadPricings();
    } catch (error: any) {
      showToast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (pricing: PackagePricing) => {
    setEditingId(pricing.id);
    setFormData({
      packageType: pricing.packageType,
      boosterType: pricing.boosterType || '',
      serviceType: (pricing.serviceType as any) || '',
      name: pricing.name,
      totalSessions: pricing.totalSessions,
      price: pricing.price,
      productCode: pricing.productCode || '',
      isActive: pricing.isActive
    });
    setShowModal(true);
  };

  const handleToggleActive = async (pricing: PackagePricing) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing/${pricing.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !pricing.isActive
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengubah status harga paket');
      }

      showToast.success(`Harga paket berhasil ${!pricing.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      loadPricings();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal mengubah status harga paket');
    }
  };

  const handleDelete = async (pricingId: string) => {
    if (!confirm('Yakin ingin menghapus harga paket ini? Harga paket yang sedang digunakan tidak dapat dihapus.')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing/${pricingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gagal menghapus harga paket');
      }

      showToast.success('Harga paket berhasil dihapus');
      loadPricings();
    } catch (error: any) {
      showToast.error(error.message);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // ADD-ON HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleAddonSubmit = async () => {
    if (!addonFormData.productCode || !addonFormData.name || addonFormData.pricePerUnit < 0) {
      showToast.error('Mohon lengkapi semua field dengan benar');
      return;
    }

    // Validate Air Nano fields
    if (addonFormData.productType === 'AIR_NANO') {
      if (!addonFormData.airNanoColor || !addonFormData.airNanoVolume || !addonFormData.airNanoUnit) {
        showToast.error('Untuk Air Nano, warna, volume, dan unit wajib diisi');
        return;
      }
    }

    try {
      setSubmitting(true);
      
      if (editingId) {
        // Update
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/non-therapy-products/${editingId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: addonFormData.name,
            description: addonFormData.description || undefined,
            pricePerUnit: addonFormData.pricePerUnit,
            isActive: addonFormData.isActive,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Gagal mengupdate add-on');
        }

        showToast.success('Add-on berhasil diupdate');
      } else {
        // Create
        const payload: any = {
          productCode: addonFormData.productCode,
          productType: addonFormData.productType,
          name: addonFormData.name,
          description: addonFormData.description || undefined,
          pricePerUnit: addonFormData.pricePerUnit,
          isActive: addonFormData.isActive,
        };

        // Add Air Nano specific fields
        if (addonFormData.productType === 'AIR_NANO') {
          payload.airNanoColor = addonFormData.airNanoColor;
          payload.airNanoVolume = addonFormData.airNanoVolume;
          payload.airNanoUnit = addonFormData.airNanoUnit;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/non-therapy-products`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Gagal menambahkan add-on');
        }

        showToast.success('Add-on berhasil ditambahkan');
      }
      
      setShowModal(false);
      resetAddonForm();
      loadProducts();
    } catch (error: any) {
      showToast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAddon = (product: NonTherapyProduct) => {
    setEditingId(product.id);
    setAddonFormData({
      productCode: product.productCode,
      productType: product.productType,
      name: product.name,
      description: product.description || '',
      pricePerUnit: product.pricePerUnit,
      airNanoColor: product.airNanoColor || '',
      airNanoVolume: product.airNanoVolume || '',
      airNanoUnit: product.airNanoUnit || '',
      isActive: product.isActive
    });
    setShowModal(true);
  };

  const handleToggleAddonActive = async (product: NonTherapyProduct) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/non-therapy-products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !product.isActive
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengubah status add-on');
      }

      showToast.success(`Add-on berhasil ${!product.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      loadProducts();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal mengubah status add-on');
    }
  };

  const handleDeleteAddon = async (productId: string) => {
    if (!confirm('Yakin ingin menghapus add-on ini? Add-on yang sedang digunakan tidak dapat dihapus.')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/non-therapy-products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gagal menghapus add-on');
      }

      showToast.success('Add-on berhasil dihapus');
      loadProducts();
    } catch (error: any) {
      showToast.error(error.message);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // MASTER DATA HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleMasterSubmit = async () => {
    const isBooster = masterTab === 'booster';
    
    if (!masterFormData.code || !masterFormData.name) {
      showToast.error('Kode dan nama wajib diisi');
      return;
    }

    try {
      setSubmitting(true);
      const endpoint = isBooster ? 'booster-types' : 'service-types';
      
      if (editingId) {
        // Update
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/${endpoint}/${editingId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: masterFormData.name,
            icon: isBooster ? masterFormData.icon : undefined,
            description: masterFormData.description || undefined,
            isActive: masterFormData.isActive,
            sortOrder: masterFormData.sortOrder,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Gagal mengupdate data');
        }

        showToast.success(`${isBooster ? 'Tipe booster' : 'Tipe layanan'} berhasil diupdate`);
      } else {
        // Create
        const payload: any = {
          code: masterFormData.code.toUpperCase(),
          name: masterFormData.name,
          description: masterFormData.description || undefined,
          sortOrder: masterFormData.sortOrder,
        };

        if (isBooster) {
          payload.icon = masterFormData.icon;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Gagal menambahkan data');
        }

        showToast.success(`${isBooster ? 'Tipe booster' : 'Tipe layanan'} berhasil ditambahkan`);
      }
      
      setShowModal(false);
      resetMasterForm();
      loadMasterData();
    } catch (error: any) {
      showToast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditMaster = (item: MasterBoosterType | MasterServiceType) => {
    setEditingId(item.id);
    setMasterFormData({
      code: item.code,
      name: item.name,
      icon: 'icon' in item ? item.icon || '' : '',
      description: item.description || '',
      sortOrder: item.sortOrder,
      isActive: item.isActive
    });
    setShowModal(true);
  };

  const handleToggleMasterActive = async (item: MasterBoosterType | MasterServiceType) => {
    const isBooster = masterTab === 'booster';
    const endpoint = isBooster ? 'booster-types' : 'service-types';
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/${endpoint}/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !item.isActive
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengubah status');
      }

      showToast.success(`${isBooster ? 'Tipe booster' : 'Tipe layanan'} berhasil ${!item.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      loadMasterData();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal mengubah status');
    }
  };

  const handleDeleteMaster = async (item: MasterBoosterType | MasterServiceType) => {
    const isBooster = masterTab === 'booster';
    const endpoint = isBooster ? 'booster-types' : 'service-types';
    
    if (!confirm(`Yakin ingin menghapus ${isBooster ? 'tipe booster' : 'tipe layanan'} ini? Data yang sedang digunakan tidak dapat dihapus.`)) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/${endpoint}/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gagal menghapus data');
      }

      showToast.success(`${isBooster ? 'Tipe booster' : 'Tipe layanan'} berhasil dihapus`);
      loadMasterData();
    } catch (error: any) {
      showToast.error(error.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      packageType: 'BASIC',
      boosterType: '',
      serviceType: '',
      name: '',
      totalSessions: 7,
      price: 0,
      productCode: '',
      isActive: true
    });
  };

  const resetAddonForm = () => {
    setEditingId(null);
    setAddonFormData({
      productCode: '',
      productType: 'AIR_NANO',
      name: '',
      description: '',
      pricePerUnit: 0,
      airNanoColor: '',
      airNanoVolume: '',
      airNanoUnit: '',
      isActive: true
    });
  };

  const resetMasterForm = () => {
    setEditingId(null);
    setMasterFormData({
      code: '',
      name: '',
      icon: '',
      description: '',
      sortOrder: 0,
      isActive: true
    });
  };

  // Group pricings by branch for display
  const groupedByBranch = pricings.reduce((acc, pricing) => {
    const branchKey = pricing.branchId || 'global';
    if (!acc[branchKey]) {
      acc[branchKey] = {
        branchCode: pricing.branch?.branchCode || '',
        branchName: pricing.branch?.name || 'Global (Semua Cabang)',
        pricings: []
      };
    }
    acc[branchKey].pricings.push(pricing);
    return acc;
  }, {} as Record<string, { branchCode: string; branchName: string; pricings: PackagePricing[] }>);

  const getPackageName = (pricing: PackagePricing) => {
    const type = pricing.packageType === 'BASIC' ? 'Basic' : 'Booster';
    return `${type} ${pricing.totalSessions} Sesi`;
  };

  if (!canManage) {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessDeniedIcon}>🔒</div>
        <h2>Akses Ditolak</h2>
        <p>Anda tidak memiliki akses ke halaman ini</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>💰 Kelola Harga Paket & Add-on</h1>
          <p>
            {isAdminCabang ? 'Atur harga paket terapi dan add-on untuk cabang Anda' : 'Kelola harga paket terapi dan add-on untuk semua cabang'}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              if (activeTab === 'packages') {
                resetForm();
              } else if (activeTab === 'addons') {
                if (!canManageAddons) {
                  showToast.error('Hanya SUPER_ADMIN dan ADMIN_MANAGER yang dapat mengelola add-on');
                  return;
                }
                resetAddonForm();
              } else if (activeTab === 'master') {
                if (!isSuperAdmin && !isAdminCabang) {
                  showToast.error('Hanya SUPER_ADMIN dan ADMIN_CABANG yang dapat mengelola master data');
                  return;
                }
                resetMasterForm();
              }
              setShowModal(true);
            }}
            className={styles.addBtn}
          >
            ➕ Tambah {activeTab === 'packages' ? 'Harga Paket' : activeTab === 'addons' ? 'Add-on' : masterTab === 'booster' ? 'Tipe Booster' : 'Tipe Layanan'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('packages')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'packages' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'packages' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'packages' ? '3px solid var(--color-primary)' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
        >
          📦 Paket Terapi
        </button>
        <button
          onClick={() => setActiveTab('addons')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'addons' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'addons' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'addons' ? '3px solid var(--color-primary)' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
        >
          ✨ Add-on
        </button>
        {(isSuperAdmin || isAdminCabang) && (
          <button
            onClick={() => setActiveTab('master')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'master' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'master' ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === 'master' ? '3px solid var(--color-primary)' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
          >
            ⚙️ Master Data
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data...</p>
        </div>
      ) : activeTab === 'packages' ? (
        pricings.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📦</div>
            <h3>Belum ada harga paket</h3>
            <p>Klik tombol "Tambah Harga Paket" untuk menambahkan harga paket baru</p>
          </div>
        ) : (
        <div className={styles.content}>
          {Object.entries(groupedByBranch).map(([branchId, branchData]) => {
            const basicPricings = branchData.pricings.filter(p => p.packageType === 'BASIC');
            const boosterPricings = branchData.pricings.filter(p => p.packageType === 'BOOSTER');

            return (
              <div key={branchId} className={styles.branchSection}>
                <div className={styles.branchHeader}>
                  <h3>
                    🏢 {branchData.branchName}
                    {branchData.branchCode && ` (${branchData.branchCode})`}
                  </h3>
                  <span className={styles.packageCount}>
                    {branchData.pricings.length} paket
                  </span>
                </div>

                {/* BASIC PACKAGES */}
                {basicPricings.length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
                      📦 Paket Terapi Basic
                    </h4>
                    <div className={styles.pricingGrid}>
                      {basicPricings.map((pricing) => (
                        <div key={pricing.id} className={styles.pricingCard}>
                          <div className={styles.pricingHeader}>
                            <div>
                              <span className={`${styles.typeBadge} ${styles.typeBasic}`}>
                                📦 BASIC
                              </span>
                              <h4>{pricing.name}</h4>
                              {pricing.productCode && (
                                <p className={styles.productCode}>Kode: {pricing.productCode}</p>
                              )}
                            </div>
                            <span className={`${styles.statusBadge} ${pricing.isActive ? styles.statusActive : styles.statusInactive}`}>
                              {pricing.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                            </span>
                          </div>

                          <div className={styles.pricingBody}>
                            <div className={styles.priceDisplay}>
                              <span className={styles.priceLabel}>Harga</span>
                              <span className={styles.priceValue}>{formatCurrency(pricing.price)}</span>
                            </div>
                            <div className={styles.sessionInfo}>
                              <span className={styles.sessionLabel}>Jumlah Sesi</span>
                              <span className={styles.sessionValue}>{pricing.totalSessions} sesi</span>
                            </div>
                          </div>

                          {canManage && (
                            <div className={styles.pricingActions}>
                              <button
                                onClick={() => handleEdit(pricing)}
                                className={`${styles.actionBtn} ${styles.editBtn}`}
                                title="Edit"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleToggleActive(pricing)}
                                className={`${styles.actionBtn} ${pricing.isActive ? styles.deactivateBtn : styles.activateBtn}`}
                                title={pricing.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              >
                                {pricing.isActive ? '🔒 Nonaktifkan' : '🔓 Aktifkan'}
                              </button>
                              <button
                                onClick={() => handleDelete(pricing.id)}
                                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                title="Hapus"
                              >
                                🗑️ Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BOOSTER PACKAGES */}
                {boosterPricings.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        🚀 Paket Booster
                      </h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {boosterPricings.length} paket (7 tipe × 5 layanan)
                      </span>
                    </div>

                    {/* Group by booster type */}
                    {['NO', 'GT', 'MB', 'KCL', 'H2S', 'HK', 'O3'].map((boosterType) => {
                      const boosterGroup = boosterPricings.filter(p => p.boosterType === boosterType);
                      if (boosterGroup.length === 0) return null;

                      const boosterIcon = 
                        boosterType === 'NO' ? '🔵' :
                        boosterType === 'GT' ? '💚' :
                        boosterType === 'MB' ? '🔷' :
                        boosterType === 'KCL' ? '⚪' :
                        boosterType === 'H2S' ? '🟡' :
                        boosterType === 'HK' ? '🔴' :
                        boosterType === 'O3' ? '🌀' : '🚀';

                      const boosterName = boosterGroup[0]?.name.split(' - ')[0] || boosterType;

                      return (
                        <div key={boosterType} style={{ marginBottom: '24px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-secondary)' }}>
                          <h5 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
                            {boosterIcon} {boosterName}
                          </h5>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                            {boosterGroup.map((pricing) => {
                              const serviceTypeLabel = 
                                pricing.serviceType === 'PM' ? 'Premiere' :
                                pricing.serviceType === 'PS' ? 'Partnership' :
                                pricing.serviceType === 'PTY' ? 'Partnership Attiya' :
                                pricing.serviceType === 'PDA' ? 'Partnership Dr. Abhi' :
                                pricing.serviceType === 'PHC' ? 'Partnership Homecare' :
                                pricing.serviceType || 'Unknown';

                              return (
                                <div key={pricing.id} className={styles.pricingCard} style={{ marginBottom: '0' }}>
                                  <div className={styles.pricingHeader}>
                                    <div>
                                      <span className={`${styles.typeBadge} ${styles.typeBooster}`} style={{ fontSize: '11px', padding: '2px 6px' }}>
                                        {pricing.serviceType || 'N/A'}
                                      </span>
                                      <h6 style={{ fontSize: '13px', fontWeight: '600', marginTop: '6px', marginBottom: '4px', color: 'var(--text-primary)' }}>
                                        {serviceTypeLabel}
                                      </h6>
                                      {pricing.productCode && (
                                        <p className={styles.productCode} style={{ fontSize: '10px' }}>
                                          {pricing.productCode}
                                        </p>
                                      )}
                                    </div>
                                    <span className={`${styles.statusBadge} ${pricing.isActive ? styles.statusActive : styles.statusInactive}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                      {pricing.isActive ? '✅' : '❌'}
                                    </span>
                                  </div>

                                  <div className={styles.pricingBody}>
                                    <div className={styles.priceDisplay}>
                                      <span className={styles.priceLabel} style={{ fontSize: '11px' }}>Harga</span>
                                      <span className={styles.priceValue} style={{ fontSize: '14px' }}>
                                        {formatCurrency(pricing.price)}
                                      </span>
                                    </div>
                                  </div>

                                  {canManage && (
                                    <div className={styles.pricingActions} style={{ gap: '6px' }}>
                                      <button
                                        onClick={() => handleEdit(pricing)}
                                        className={`${styles.actionBtn} ${styles.editBtn}`}
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        title="Edit"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => handleToggleActive(pricing)}
                                        className={`${styles.actionBtn} ${pricing.isActive ? styles.deactivateBtn : styles.activateBtn}`}
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        title={pricing.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                      >
                                        {pricing.isActive ? '🔒' : '🔓'}
                                      </button>
                                      <button
                                        onClick={() => handleDelete(pricing.id)}
                                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        title="Hapus"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )
      ) : (
        /* ADD-ON TAB */
        products.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✨</div>
            <h3>Belum ada add-on</h3>
            <p>Klik tombol "Tambah Add-on" untuk menambahkan produk add-on baru</p>
          </div>
        ) : (
          <div className={styles.content}>
            {/* Group by product type */}
            {['AIR_NANO', 'ROKOK_KENKOU'].map((productType) => {
              const typeProducts = products.filter(p => p.productType === productType);
              if (typeProducts.length === 0) return null;

              const typeIcon = productType === 'AIR_NANO' ? '💧' : '🚬';
              const typeName = productType === 'AIR_NANO' ? 'Air Nano' : 'Rokok Kenkou';

              return (
                <div key={productType} className={styles.branchSection}>
                  <div className={styles.branchHeader}>
                    <h3>{typeIcon} {typeName}</h3>
                    <span className={styles.packageCount}>{typeProducts.length} produk</span>
                  </div>

                  <div className={styles.pricingGrid}>
                    {typeProducts.map((product) => (
                      <div key={product.id} className={styles.pricingCard}>
                        <div className={styles.pricingHeader}>
                          <div>
                            <span className={`${styles.typeBadge} ${styles.typeBooster}`}>
                              {product.productType === 'AIR_NANO' ? '💧 AIR NANO' : '🚬 ROKOK'}
                            </span>
                            <h4>{product.name}</h4>
                            {product.productCode && (
                              <p className={styles.productCode}>Kode: {product.productCode}</p>
                            )}
                            {product.description && (
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {product.description}
                              </p>
                            )}
                          </div>
                          <span className={`${styles.statusBadge} ${product.isActive ? styles.statusActive : styles.statusInactive}`}>
                            {product.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                          </span>
                        </div>

                        <div className={styles.pricingBody}>
                          {product.productType === 'AIR_NANO' && (
                            <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Warna:</span>
                                  <span style={{ marginLeft: '4px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    {product.airNanoColor === 'KUNING' ? '🟡 Kuning' :
                                     product.airNanoColor === 'BIRU' ? '🔵 Biru' :
                                     product.airNanoColor === 'HIJAU' ? '🟢 Hijau' : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Volume:</span>
                                  <span style={{ marginLeft: '4px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    {product.airNanoVolume === 'ML_600' ? '600ml' :
                                     product.airNanoVolume === 'ML_1500' ? '1500ml' : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Unit:</span>
                                  <span style={{ marginLeft: '4px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    {product.airNanoUnit === 'BOTOL' ? '📦 Botol' :
                                     product.airNanoUnit === 'DUS' ? '📦 Dus' : '-'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className={styles.priceDisplay}>
                            <span className={styles.priceLabel}>Harga per Unit</span>
                            <span className={styles.priceValue}>{formatCurrency(product.pricePerUnit)}</span>
                          </div>
                        </div>

                        {canManageAddons && (
                          <div className={styles.pricingActions}>
                            <button
                              onClick={() => handleEditAddon(product)}
                              className={`${styles.actionBtn} ${styles.editBtn}`}
                              title="Edit"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleToggleAddonActive(product)}
                              className={`${styles.actionBtn} ${product.isActive ? styles.deactivateBtn : styles.activateBtn}`}
                              title={product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {product.isActive ? '🔒 Nonaktifkan' : '🔓 Aktifkan'}
                            </button>
                            <button
                              onClick={() => handleDeleteAddon(product.id)}
                              className={`${styles.actionBtn} ${styles.deleteBtn}`}
                              title="Hapus"
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* MASTER DATA TAB */}
      {activeTab === 'master' && (
        <div className={styles.content}>
          {/* Sub-tabs for Master Data */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setMasterTab('booster')}
              style={{
                padding: '8px 16px',
                background: masterTab === 'booster' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: masterTab === 'booster' ? '#60a5fa' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: masterTab === 'booster' ? '2px solid #60a5fa' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s',
              }}
            >
              🚀 Tipe Booster
            </button>
            <button
              onClick={() => setMasterTab('service')}
              style={{
                padding: '8px 16px',
                background: masterTab === 'service' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: masterTab === 'service' ? '#60a5fa' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: masterTab === 'service' ? '2px solid #60a5fa' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s',
              }}
            >
              🏥 Tipe Layanan
            </button>
          </div>

          {masterTab === 'booster' ? (
            /* BOOSTER TYPES */
            boosterTypes.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🚀</div>
                <h3>Belum ada tipe booster</h3>
                <p>Klik tombol "Tambah Tipe Booster" untuk menambahkan tipe booster baru</p>
              </div>
            ) : (
              <div className={styles.pricingGrid}>
                {boosterTypes.map((type) => (
                  <div key={type.id} className={styles.pricingCard}>
                    <div className={styles.pricingHeader}>
                      <div>
                        <span className={`${styles.typeBadge} ${styles.typeBooster}`}>
                          {type.icon || '🚀'} {type.code}
                        </span>
                        <h4>{type.name}</h4>
                        {type.description && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {type.description}
                          </p>
                        )}
                      </div>
                      <span className={`${styles.statusBadge} ${type.isActive ? styles.statusActive : styles.statusInactive}`}>
                        {type.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                      </span>
                    </div>

                    <div className={styles.pricingBody}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Urutan:</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          #{type.sortOrder}
                        </span>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className={styles.pricingActions}>
                        <button
                          onClick={() => handleEditMaster(type)}
                          className={`${styles.actionBtn} ${styles.editBtn}`}
                          title="Edit"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleToggleMasterActive(type)}
                          className={`${styles.actionBtn} ${type.isActive ? styles.deactivateBtn : styles.activateBtn}`}
                          title={type.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {type.isActive ? '🔒 Nonaktifkan' : '🔓 Aktifkan'}
                        </button>
                        <button
                          onClick={() => handleDeleteMaster(type)}
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          title="Hapus"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            /* SERVICE TYPES */
            serviceTypes.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🏥</div>
                <h3>Belum ada tipe layanan</h3>
                <p>Klik tombol "Tambah Tipe Layanan" untuk menambahkan tipe layanan baru</p>
              </div>
            ) : (
              <div className={styles.pricingGrid}>
                {serviceTypes.map((type) => (
                  <div key={type.id} className={styles.pricingCard}>
                    <div className={styles.pricingHeader}>
                      <div>
                        <span className={`${styles.typeBadge} ${styles.typeBasic}`}>
                          🏥 {type.code}
                        </span>
                        <h4>{type.name}</h4>
                        {type.description && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {type.description}
                          </p>
                        )}
                      </div>
                      <span className={`${styles.statusBadge} ${type.isActive ? styles.statusActive : styles.statusInactive}`}>
                        {type.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                      </span>
                    </div>

                    <div className={styles.pricingBody}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Urutan:</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          #{type.sortOrder}
                        </span>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className={styles.pricingActions}>
                        <button
                          onClick={() => handleEditMaster(type)}
                          className={`${styles.actionBtn} ${styles.editBtn}`}
                          title="Edit"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleToggleMasterActive(type)}
                          className={`${styles.actionBtn} ${type.isActive ? styles.deactivateBtn : styles.activateBtn}`}
                          title={type.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {type.isActive ? '🔒 Nonaktifkan' : '🔓 Aktifkan'}
                        </button>
                        <button
                          onClick={() => handleDeleteMaster(type)}
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          title="Hapus"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Modal Add/Edit */}
      {showModal && createPortal(
        <div 
          className={styles.modal}
          onClick={(e) => { 
            if (e.target === e.currentTarget) {
              setShowModal(false); 
              if (activeTab === 'packages') {
                resetForm();
              } else if (activeTab === 'addons') {
                resetAddonForm();
              } else {
                resetMasterForm();
              }
            }
          }}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>
                {activeTab === 'packages' 
                  ? (editingId ? '✏️ Edit Harga Paket' : '➕ Tambah Harga Paket')
                  : activeTab === 'addons'
                  ? (editingId ? '✏️ Edit Add-on' : '➕ Tambah Add-on')
                  : masterTab === 'booster'
                  ? (editingId ? '✏️ Edit Tipe Booster' : '➕ Tambah Tipe Booster')
                  : (editingId ? '✏️ Edit Tipe Layanan' : '➕ Tambah Tipe Layanan')}
              </h3>
              <button 
                className={styles.closeBtn}
                onClick={() => { 
                  setShowModal(false); 
                  if (activeTab === 'packages') {
                    resetForm();
                  } else if (activeTab === 'addons') {
                    resetAddonForm();
                  } else {
                    resetMasterForm();
                  }
                }}
              >✕</button>
            </div>

            <div className={styles.modalBody}>
              {activeTab === 'packages' ? (
                /* PACKAGE FORM */
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tipe Paket</label>
                    <select
                      value={formData.packageType}
                      onChange={(e) => {
                        const newType = e.target.value as 'BASIC' | 'BOOSTER';
                        setFormData({ 
                          ...formData, 
                          packageType: newType,
                          boosterType: newType === 'BASIC' ? '' : formData.boosterType,
                          serviceType: newType === 'BASIC' ? '' : formData.serviceType,
                          totalSessions: newType === 'BASIC' ? 7 : 1,
                        });
                      }}
                      className={styles.formInput}
                      disabled={!!editingId}
                    >
                      <option value="BASIC">📦 BASIC (Terapi Nano Bubble)</option>
                      <option value="BOOSTER">🚀 BOOSTER (Tambahan Terapi)</option>
                    </select>
                    {!editingId && (
                      <p className={styles.formHint}>
                        {formData.packageType === 'BASIC' 
                          ? 'Paket terapi utama dengan berbagai jumlah sesi (1X, 7X, 15X, dll)'
                          : 'Paket booster dengan 7 tipe (NO, GT, MB, KCL, H2S, HK, O3) dan 5 tipe layanan (PM, PS, PTY, PDA, PHC)'}
                      </p>
                    )}
                    {editingId && <p className={styles.formHint}>Tipe paket tidak dapat diubah</p>}
                  </div>

                  {formData.packageType === 'BOOSTER' && (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Tipe Booster *</label>
                        <select
                          value={formData.boosterType}
                          onChange={(e) => setFormData({ ...formData, boosterType: e.target.value as any })}
                          className={styles.formInput}
                          disabled={!!editingId}
                        >
                          <option value="">-- Pilih Tipe Booster --</option>
                          <option value="NO">🔵 NO (Nitric Oxide)</option>
                          <option value="GT">💚 GT (Glutathione)</option>
                          <option value="MB">🔷 MB (Methylene Blue)</option>
                          <option value="KCL">⚪ KCL (Potassium Chloride)</option>
                          <option value="H2S">🟡 H2S (Hydrogen Sulfide)</option>
                          <option value="HK">🔴 HK (Hypochlorous Acid)</option>
                          <option value="O3">🌀 O3 (Ozone)</option>
                        </select>
                        {editingId && <p className={styles.formHint}>Tipe booster tidak dapat diubah</p>}
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Tipe Layanan *</label>
                        <select
                          value={formData.serviceType}
                          onChange={(e) => setFormData({ ...formData, serviceType: e.target.value as any })}
                          className={styles.formInput}
                          disabled={!!editingId}
                        >
                          <option value="">-- Pilih Tipe Layanan --</option>
                          <option value="PM">PM - Premiere (Rp 1.000.000)</option>
                          <option value="PS">PS - Partnership (Rp 650.000)</option>
                          <option value="PTY">PTY - Partnership Attiya (Rp 600.000)</option>
                          <option value="PDA">PDA - Partnership Dr. Abhi (Rp 65.000/ml)</option>
                          <option value="PHC">PHC - Partnership Homecare (Rp 750.000)</option>
                        </select>
                        {editingId && <p className={styles.formHint}>Tipe layanan tidak dapat diubah</p>}
                      </div>
                    </>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nama Paket *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={styles.formInput}
                      placeholder="Contoh: Terapi Nano Bubble 7X"
                      disabled={!!editingId}
                    />
                    {editingId && <p className={styles.formHint}>Nama paket tidak dapat diubah</p>}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Kode Produk (Opsional)</label>
                    <input
                      type="text"
                      value={formData.productCode}
                      onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                      className={styles.formInput}
                      placeholder="Contoh: TNB-P7-PM"
                      disabled={!!editingId}
                    />
                    {editingId && <p className={styles.formHint}>Kode produk tidak dapat diubah</p>}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Jumlah Sesi</label>
                    <input
                      type="number"
                      value={formData.totalSessions}
                      onChange={(e) => setFormData({ ...formData, totalSessions: parseInt(e.target.value) || 0 })}
                      className={styles.formInput}
                      min="1"
                      disabled={!!editingId}
                    />
                    {editingId && <p className={styles.formHint}>Jumlah sesi tidak dapat diubah</p>}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Harga (Rp)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                      className={styles.formInput}
                      min="0"
                      step="100000"
                      placeholder="Contoh: 12500000"
                    />
                    <p className={styles.formHint}>Preview: {formatCurrency(formData.price)}</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className={styles.checkbox}
                      />
                      <span>Aktif</span>
                    </label>
                  </div>
                </>
              ) : activeTab === 'addons' ? (
                /* ADD-ON FORM */
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tipe Produk</label>
                    <select
                      value={addonFormData.productType}
                      onChange={(e) => setAddonFormData({ 
                        ...addonFormData, 
                        productType: e.target.value as 'AIR_NANO' | 'ROKOK_KENKOU',
                        airNanoColor: '',
                        airNanoVolume: '',
                        airNanoUnit: ''
                      })}
                      className={styles.formInput}
                      disabled={!!editingId}
                    >
                      <option value="AIR_NANO">💧 Air Nano</option>
                      <option value="ROKOK_KENKOU">🚬 Rokok Kenkou</option>
                    </select>
                    {editingId && <p className={styles.formHint}>Tipe produk tidak dapat diubah</p>}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Kode Produk *</label>
                    <input
                      type="text"
                      value={addonFormData.productCode}
                      onChange={(e) => setAddonFormData({ ...addonFormData, productCode: e.target.value })}
                      className={styles.formInput}
                      placeholder="Contoh: AN-KUNING-600ML"
                      disabled={!!editingId}
                    />
                    {editingId && <p className={styles.formHint}>Kode produk tidak dapat diubah</p>}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nama Produk *</label>
                    <input
                      type="text"
                      value={addonFormData.name}
                      onChange={(e) => setAddonFormData({ ...addonFormData, name: e.target.value })}
                      className={styles.formInput}
                      placeholder="Contoh: Air Nano Kuning 600ml"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Deskripsi (Opsional)</label>
                    <textarea
                      value={addonFormData.description}
                      onChange={(e) => setAddonFormData({ ...addonFormData, description: e.target.value })}
                      className={styles.formInput}
                      placeholder="Deskripsi produk..."
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  {addonFormData.productType === 'AIR_NANO' && (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Warna *</label>
                        <select
                          value={addonFormData.airNanoColor}
                          onChange={(e) => setAddonFormData({ ...addonFormData, airNanoColor: e.target.value as any })}
                          className={styles.formInput}
                          disabled={!!editingId}
                        >
                          <option value="">-- Pilih Warna --</option>
                          <option value="KUNING">🟡 Kuning</option>
                          <option value="BIRU">🔵 Biru</option>
                          <option value="HIJAU">🟢 Hijau</option>
                        </select>
                        {editingId && <p className={styles.formHint}>Warna tidak dapat diubah</p>}
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Volume *</label>
                        <select
                          value={addonFormData.airNanoVolume}
                          onChange={(e) => setAddonFormData({ ...addonFormData, airNanoVolume: e.target.value as any })}
                          className={styles.formInput}
                          disabled={!!editingId}
                        >
                          <option value="">-- Pilih Volume --</option>
                          <option value="ML_600">600ml</option>
                          <option value="ML_1500">1500ml</option>
                        </select>
                        {editingId && <p className={styles.formHint}>Volume tidak dapat diubah</p>}
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Unit *</label>
                        <select
                          value={addonFormData.airNanoUnit}
                          onChange={(e) => setAddonFormData({ ...addonFormData, airNanoUnit: e.target.value as any })}
                          className={styles.formInput}
                          disabled={!!editingId}
                        >
                          <option value="">-- Pilih Unit --</option>
                          <option value="BOTOL">📦 Botol</option>
                          <option value="DUS">📦 Dus</option>
                        </select>
                        {editingId && <p className={styles.formHint}>Unit tidak dapat diubah</p>}
                      </div>
                    </>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Harga per Unit (Rp)</label>
                    <input
                      type="number"
                      value={addonFormData.pricePerUnit}
                      onChange={(e) => setAddonFormData({ ...addonFormData, pricePerUnit: parseInt(e.target.value) || 0 })}
                      className={styles.formInput}
                      min="0"
                      step="10000"
                      placeholder="Contoh: 150000"
                    />
                    <p className={styles.formHint}>Preview: {formatCurrency(addonFormData.pricePerUnit)}</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={addonFormData.isActive}
                        onChange={(e) => setAddonFormData({ ...addonFormData, isActive: e.target.checked })}
                        className={styles.checkbox}
                      />
                      <span>Aktif</span>
                    </label>
                  </div>
                </>
              ) : (
                /* MASTER DATA FORM */
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Kode *</label>
                    <input
                      type="text"
                      value={masterFormData.code}
                      onChange={(e) => setMasterFormData({ ...masterFormData, code: e.target.value.toUpperCase() })}
                      className={styles.formInput}
                      placeholder="Contoh: NO, GT, PM, PS"
                      disabled={!!editingId}
                      maxLength={10}
                    />
                    {editingId && <p className={styles.formHint}>Kode tidak dapat diubah</p>}
                    {!editingId && <p className={styles.formHint}>Kode unik untuk identifikasi (huruf besar, max 10 karakter)</p>}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nama *</label>
                    <input
                      type="text"
                      value={masterFormData.name}
                      onChange={(e) => setMasterFormData({ ...masterFormData, name: e.target.value })}
                      className={styles.formInput}
                      placeholder={masterTab === 'booster' ? 'Contoh: Nitric Oxide' : 'Contoh: Premiere'}
                    />
                  </div>

                  {masterTab === 'booster' && (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Icon (Emoji)</label>
                      <input
                        type="text"
                        value={masterFormData.icon}
                        onChange={(e) => setMasterFormData({ ...masterFormData, icon: e.target.value })}
                        className={styles.formInput}
                        placeholder="Contoh: 🔵 💚 🔷"
                        maxLength={2}
                      />
                      <p className={styles.formHint}>Emoji untuk tampilan visual (opsional)</p>
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Deskripsi (Opsional)</label>
                    <textarea
                      value={masterFormData.description}
                      onChange={(e) => setMasterFormData({ ...masterFormData, description: e.target.value })}
                      className={styles.formInput}
                      placeholder="Deskripsi singkat..."
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Urutan Tampilan</label>
                    <input
                      type="number"
                      value={masterFormData.sortOrder}
                      onChange={(e) => setMasterFormData({ ...masterFormData, sortOrder: parseInt(e.target.value) || 0 })}
                      className={styles.formInput}
                      min="0"
                      placeholder="0"
                    />
                    <p className={styles.formHint}>Angka lebih kecil akan ditampilkan lebih dulu</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={masterFormData.isActive}
                        onChange={(e) => setMasterFormData({ ...masterFormData, isActive: e.target.checked })}
                        className={styles.checkbox}
                      />
                      <span>Aktif</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => { 
                  setShowModal(false); 
                  if (activeTab === 'packages') {
                    resetForm();
                  } else if (activeTab === 'addons') {
                    resetAddonForm();
                  } else {
                    resetMasterForm();
                  }
                }}
                className={`${styles.modalBtn} ${styles.cancelBtn}`}
              >
                Batal
              </button>
              <button
                onClick={activeTab === 'packages' ? handleSubmit : activeTab === 'addons' ? handleAddonSubmit : handleMasterSubmit}
                disabled={submitting}
                className={`${styles.modalBtn} ${styles.submitBtn}`}
              >
                {submitting ? '⏳ Menyimpan...' : editingId ? '💾 Update' : '➕ Tambah'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
