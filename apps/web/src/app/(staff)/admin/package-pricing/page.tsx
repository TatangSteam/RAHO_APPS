'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { formatCurrency } from '@/lib/formatNumber';
import { 
  Package, Plus, Edit2, Trash2, Lock, Unlock, X, Loader2, 
  Building2, Globe, Zap, Droplets, Cigarette, Settings, 
  ChevronDown, Check, AlertCircle
} from 'lucide-react';
import { devError } from '@/lib/logger';

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
  price?: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function PackagePricingPage() {
  const { user, accessToken } = useAuthStore();
  const searchParams = useSearchParams();
  const initialBranchId = searchParams.get('branchId');
  
  const [pricings, setPricings] = useState<PackagePricing[]>([]);
  const [products, setProducts] = useState<NonTherapyProduct[]>([]);
  const [boosterTypes, setBoosterTypes] = useState<MasterBoosterType[]>([]);
  const [serviceTypes, setServiceTypes] = useState<MasterServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'packages' | 'booster-matrix' | 'addons' | 'master'>('packages');
  const [masterTab, setMasterTab] = useState<'booster' | 'service'>('booster');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(initialBranchId || 'all');
  const [branches, setBranches] = useState<Array<{ id: string; name: string; branchCode: string }>>([]);
  const [formData, setFormData] = useState({
    packageType: 'BASIC' as 'BASIC' | 'BOOSTER',
    boosterType: '' as '' | 'NO' | 'GT' | 'MB' | 'KCL' | 'H2S' | 'HK' | 'O3' | 'HHO' | 'NO2',
    serviceType: '' as '' | 'PM' | 'PS' | 'PTY' | 'PDA' | 'PHC',
    name: '',
    totalSessions: 7,
    price: 0,
    productCode: '',
    branchId: '' as string,
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
    price: 0,
    sortOrder: 0,
    isActive: true
  });

  const isAdminCabang = user?.role === 'ADMIN_CABANG';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminManager = user?.role === 'ADMIN_MANAGER';
  const canManage = isAdminCabang || isSuperAdmin || isAdminManager;
  const canManageAddons = isSuperAdmin || isAdminManager;

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
        if (activeTab === 'packages' || activeTab === 'booster-matrix') {
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
      } else if (activeTab === 'booster-matrix') {
        loadPricings();
        loadMasterData();
      } else if (activeTab === 'addons') {
        loadProducts();
      } else if (activeTab === 'master') {
        loadMasterData();
      }
    }
  }, [user, accessToken, activeTab]);

  useEffect(() => {
    if ((isSuperAdmin || isAdminManager) && accessToken) {
      loadBranches();
    }
  }, [isSuperAdmin, isAdminManager, accessToken]);

  useEffect(() => {
    if (user && accessToken) {
      loadMasterData();
    }
  }, [user, accessToken]);

  const loadBranches = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/branches`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        setBranches(result.data || []);
      }
    } catch (error) {
      devError('Failed to load branches:', error);
    }
  };

  const loadPricings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Gagal memuat data harga paket');
      const data = await response.json();
      setPricings(data.data?.pricings || []);
    } catch (error: any) {
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
      if (!response.ok) throw new Error('Gagal memuat data add-on');
      const data = await response.json();
      setProducts(data.data?.products || []);
    } catch (error: any) {
      showToast.error(error.message || 'Gagal memuat data add-on');
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      setLoading(true);
      const boosterResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/booster-types`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (boosterResponse.ok) {
        const boosterData = await boosterResponse.json();
        setBoosterTypes(boosterData.data?.types || []);
      }
      const serviceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/service-types`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (serviceResponse.ok) {
        const serviceData = await serviceResponse.json();
        setServiceTypes(serviceData.data?.types || []);
      }
    } catch (error: any) {
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
    if (formData.packageType === 'BOOSTER' && !formData.boosterType) {
      showToast.error('Tipe booster wajib diisi untuk paket BOOSTER');
      return;
    }
    if (formData.packageType === 'BOOSTER' && !formData.serviceType) {
      showToast.error('Tipe layanan wajib diisi untuk paket BOOSTER');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        const payload: any = {
          packageType: formData.packageType,
          name: formData.name,
          totalSessions: formData.totalSessions,
          price: formData.price,
          productCode: formData.productCode || undefined,
          isActive: formData.isActive,
        };
        if (formData.packageType === 'BOOSTER') {
          if (formData.boosterType) payload.boosterType = formData.boosterType;
          if (formData.serviceType) payload.serviceType = formData.serviceType;
        }
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing/${editingId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Gagal mengupdate harga paket');
        }
        showToast.success('Harga paket berhasil diupdate');
      } else {
        const payload: any = {
          packageType: formData.packageType,
          name: formData.name,
          totalSessions: formData.totalSessions,
          price: formData.price,
          productCode: formData.productCode || undefined,
          isActive: formData.isActive,
        };
        if (formData.packageType === 'BOOSTER') {
          if (formData.boosterType) payload.boosterType = formData.boosterType;
          if (formData.serviceType) payload.serviceType = formData.serviceType;
        }
        if (formData.branchId) {
          payload.branchId = formData.branchId;
        } else if (isAdminCabang && user?.branchId) {
          payload.branchId = user.branchId;
        }
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || error.message || 'Gagal menambahkan harga paket');
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
      branchId: pricing.branchId || '',
      isActive: pricing.isActive
    });
    setShowModal(true);
  };

  const handleToggleActive = async (pricing: PackagePricing) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing/${pricing.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pricing.isActive }),
      });
      if (!response.ok) throw new Error('Gagal mengubah status harga paket');
      showToast.success(`Harga paket berhasil ${!pricing.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      loadPricings();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal mengubah status harga paket');
    }
  };

  const handleDelete = async (pricingId: string) => {
    if (!confirm('Yakin ingin menghapus harga paket ini?')) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing/${pricingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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

  const handleBulkCreateBooster = async (boosterCode: string, boosterName: string) => {
    const currentBranchId = selectedBranchFilter === 'global' ? null : selectedBranchFilter;
    const branchInfo = currentBranchId ? branches.find(b => b.id === currentBranchId) : null;
    const branchLabel = branchInfo ? ` di cabang ${branchInfo.branchCode}` : ' (Global)';
    const activeServiceTypes = serviceTypes.filter(st => st.isActive);
    const missingServiceTypes = activeServiceTypes.filter(st => {
      return !pricings.find(p =>
        p.packageType === 'BOOSTER' && p.boosterType === boosterCode &&
        p.serviceType === st.code && p.branchId === currentBranchId
      );
    });
    if (missingServiceTypes.length === 0) {
      showToast.success(`Booster ${boosterCode} sudah punya semua tipe layanan${branchLabel}`);
      return;
    }
    const confirmMsg = `Buat ${missingServiceTypes.length} harga booster ${boosterCode}${branchLabel}?`;
    if (!confirm(confirmMsg)) return;
    try {
      setSubmitting(true);
      let successCount = 0;
      const errors: string[] = [];
      for (const st of missingServiceTypes) {
        const payload: any = {
          packageType: 'BOOSTER', boosterType: boosterCode, serviceType: st.code,
          name: `Booster ${boosterCode} 1X - ${st.code}${branchInfo ? ` (${branchInfo.branchCode})` : ''}`,
          totalSessions: 1, price: st.price || 0,
          productCode: `BST-${boosterCode}-1X-${st.code}${branchInfo ? `-${branchInfo.branchCode}` : ''}`,
          isActive: true,
        };
        if (currentBranchId) payload.branchId = currentBranchId;
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (response.ok) successCount++;
          else {
            const err = await response.json();
            errors.push(`${st.code}: ${err.error?.message || 'gagal'}`);
          }
        } catch (e: any) { errors.push(`${st.code}: ${e.message}`); }
      }
      if (successCount > 0) showToast.success(`Berhasil membuat ${successCount} harga booster`);
      if (errors.length > 0) showToast.error(`Gagal membuat ${errors.length}: ${errors.slice(0, 2).join('; ')}`);
      loadPricings();
    } finally { setSubmitting(false); }
  };

  const handleAddonSubmit = async () => {
    if (!addonFormData.productCode || !addonFormData.name || addonFormData.pricePerUnit < 0) {
      showToast.error('Mohon lengkapi semua field dengan benar');
      return;
    }
    if (addonFormData.productType === 'AIR_NANO') {
      if (!addonFormData.airNanoColor || !addonFormData.airNanoVolume || !addonFormData.airNanoUnit) {
        showToast.error('Untuk Air Nano, warna, volume, dan unit wajib diisi');
        return;
      }
    }
    try {
      setSubmitting(true);
      if (editingId) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/non-therapy-products/${editingId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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
        const payload: any = {
          productCode: addonFormData.productCode,
          productType: addonFormData.productType,
          name: addonFormData.name,
          description: addonFormData.description || undefined,
          pricePerUnit: addonFormData.pricePerUnit,
          isActive: addonFormData.isActive,
        };
        if (addonFormData.productType === 'AIR_NANO') {
          payload.airNanoColor = addonFormData.airNanoColor;
          payload.airNanoVolume = addonFormData.airNanoVolume;
          payload.airNanoUnit = addonFormData.airNanoUnit;
        }
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/non-therapy-products`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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
    } catch (error: any) { showToast.error(error.message); }
    finally { setSubmitting(false); }
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
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      if (!response.ok) throw new Error('Gagal mengubah status add-on');
      showToast.success(`Add-on berhasil ${!product.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      loadProducts();
    } catch (error: any) { showToast.error(error.message || 'Gagal mengubah status add-on'); }
  };

  const handleDeleteAddon = async (productId: string) => {
    if (!confirm('Yakin ingin menghapus add-on ini?')) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/non-therapy-products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gagal menghapus add-on');
      }
      showToast.success('Add-on berhasil dihapus');
      loadProducts();
    } catch (error: any) { showToast.error(error.message); }
  };

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
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/${endpoint}/${editingId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: masterFormData.name,
            icon: isBooster ? masterFormData.icon : undefined,
            description: masterFormData.description || undefined,
            price: !isBooster ? masterFormData.price : undefined,
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
        const payload: any = {
          code: masterFormData.code.toUpperCase(),
          name: masterFormData.name,
          description: masterFormData.description || undefined,
          sortOrder: masterFormData.sortOrder,
        };
        if (isBooster) payload.icon = masterFormData.icon;
        else payload.price = masterFormData.price;
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/${endpoint}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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
    } catch (error: any) { showToast.error(error.message); }
    finally { setSubmitting(false); }
  };

  const handleEditMaster = (item: MasterBoosterType | MasterServiceType) => {
    setEditingId(item.id);
    setMasterFormData({
      code: item.code,
      name: item.name,
      icon: 'icon' in item ? item.icon || '' : '',
      description: item.description || '',
      price: 'price' in item ? item.price || 0 : 0,
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
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!response.ok) throw new Error('Gagal mengubah status');
      showToast.success(`${isBooster ? 'Tipe booster' : 'Tipe layanan'} berhasil ${!item.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      loadMasterData();
    } catch (error: any) { showToast.error(error.message || 'Gagal mengubah status'); }
  };

  const handleDeleteMaster = async (item: MasterBoosterType | MasterServiceType) => {
    const isBooster = masterTab === 'booster';
    const endpoint = isBooster ? 'booster-types' : 'service-types';
    if (!confirm(`Yakin ingin menghapus ${isBooster ? 'tipe booster' : 'tipe layanan'} ini?`)) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master/${endpoint}/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gagal menghapus data');
      }
      showToast.success(`${isBooster ? 'Tipe booster' : 'Tipe layanan'} berhasil dihapus`);
      loadMasterData();
    } catch (error: any) { showToast.error(error.message); }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      packageType: 'BASIC', boosterType: '', serviceType: '', name: '',
      totalSessions: 7, price: 0, productCode: '', branchId: '', isActive: true
    });
  };

  const resetAddonForm = () => {
    setEditingId(null);
    setAddonFormData({
      productCode: '', productType: 'AIR_NANO', name: '', description: '',
      pricePerUnit: 0, airNanoColor: '', airNanoVolume: '', airNanoUnit: '', isActive: true
    });
  };

  const resetMasterForm = () => {
    setEditingId(null);
    setMasterFormData({
      code: '', name: '', icon: '', description: '', price: 0, sortOrder: 0, isActive: true
    });
  };

  const filteredPricings = selectedBranchFilter === 'all' 
    ? pricings 
    : pricings.filter(p => {
        if (selectedBranchFilter === 'global') return !p.branchId;
        return p.branchId === selectedBranchFilter;
      });

  const groupedByBranch = filteredPricings.reduce((acc, pricing) => {
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

  const uniqueBranches = Array.from(
    new Map(
      pricings.filter(p => p.branch).map(p => [p.branchId, { id: p.branchId!, name: p.branch!.name, code: p.branch!.branchCode }])
    ).values()
  );
  const hasGlobalPricings = pricings.some(p => !p.branchId);

  if (!canManage) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center max-w-md">
          <Lock className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Akses Ditolak</h2>
          <p className="text-neutral-500 dark:text-neutral-400">Anda tidak memiliki akses ke halaman ini</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'packages', label: 'Paket Terapi', icon: Package },
    { id: 'booster-matrix', label: 'Booster Matrix', icon: Zap },
    { id: 'addons', label: 'Add-on', icon: Droplets },
    ...(isSuperAdmin || isAdminCabang ? [{ id: 'master', label: 'Master Data', icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Kelola Harga Paket & Add-on</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {isAdminCabang ? 'Atur harga paket terapi dan add-on untuk cabang Anda' : 'Kelola harga paket terapi dan add-on untuk semua cabang'}
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {(isSuperAdmin || isAdminManager) && activeTab === 'packages' && (
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="px-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-w-[200px]"
              >
                <option value="all">🏢 Semua Cabang</option>
                {hasGlobalPricings && <option value="global">🌐 Global</option>}
                {uniqueBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.code} - {branch.name}</option>
                ))}
              </select>
            )}
            {canManage && (
              <button
                onClick={() => {
                  if (activeTab === 'packages') resetForm();
                  else if (activeTab === 'addons') {
                    if (!canManageAddons) { showToast.error('Hanya SUPER_ADMIN dan ADMIN_MANAGER yang dapat mengelola add-on'); return; }
                    resetAddonForm();
                  } else if (activeTab === 'master') {
                    if (!isSuperAdmin && !isAdminCabang) { showToast.error('Hanya SUPER_ADMIN dan ADMIN_CABANG yang dapat mengelola master data'); return; }
                    resetMasterForm();
                  }
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold text-sm hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/30"
              >
                <Plus className="h-4 w-4" />
                Tambah {activeTab === 'packages' ? 'Harga Paket' : activeTab === 'addons' ? 'Add-on' : masterTab === 'booster' ? 'Tipe Booster' : 'Tipe Layanan'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white dark:bg-neutral-900 p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500 mb-4" />
            <p className="text-neutral-500 dark:text-neutral-400">Memuat data...</p>
          </div>
        ) : activeTab === 'booster-matrix' ? (
          <BoosterMatrixTab
            boosterTypes={boosterTypes}
            serviceTypes={serviceTypes}
            pricings={pricings}
            branches={branches}
            selectedBranchFilter={selectedBranchFilter}
            setSelectedBranchFilter={setSelectedBranchFilter}
            canManage={canManage}
            submitting={submitting}
            handleBulkCreateBooster={handleBulkCreateBooster}
            handleEdit={handleEdit}
            setFormData={setFormData}
            setEditingId={setEditingId}
            setShowModal={setShowModal}
          />
        ) : activeTab === 'packages' ? (
          <PackagesTab
            filteredPricings={filteredPricings}
            groupedByBranch={groupedByBranch}
            canManage={canManage}
            handleEdit={handleEdit}
            handleToggleActive={handleToggleActive}
            handleDelete={handleDelete}
          />
        ) : activeTab === 'addons' ? (
          <AddonsTab
            products={products}
            canManageAddons={canManageAddons}
            handleEditAddon={handleEditAddon}
            handleToggleAddonActive={handleToggleAddonActive}
            handleDeleteAddon={handleDeleteAddon}
          />
        ) : activeTab === 'master' ? (
          <MasterDataTab
            masterTab={masterTab}
            setMasterTab={setMasterTab}
            boosterTypes={boosterTypes}
            serviceTypes={serviceTypes}
            isSuperAdmin={isSuperAdmin}
            handleEditMaster={handleEditMaster}
            handleToggleMasterActive={handleToggleMasterActive}
            handleDeleteMaster={handleDeleteMaster}
          />
        ) : null}

        {/* Modal */}
        {showModal && createPortal(
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { 
              if (e.target === e.currentTarget) {
                setShowModal(false); 
                if (activeTab === 'packages' || activeTab === 'booster-matrix') resetForm();
                else if (activeTab === 'addons') resetAddonForm();
                else resetMasterForm();
              }
            }}
          >
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  {activeTab === 'packages' || activeTab === 'booster-matrix'
                    ? (editingId ? 'Edit Harga Paket' : 'Tambah Harga Paket')
                    : activeTab === 'addons'
                    ? (editingId ? 'Edit Add-on' : 'Tambah Add-on')
                    : masterTab === 'booster'
                    ? (editingId ? 'Edit Tipe Booster' : 'Tambah Tipe Booster')
                    : (editingId ? 'Edit Tipe Layanan' : 'Tambah Tipe Layanan')}
                </h3>
                <button 
                  onClick={() => { 
                    setShowModal(false); 
                    if (activeTab === 'packages' || activeTab === 'booster-matrix') resetForm();
                    else if (activeTab === 'addons') resetAddonForm();
                    else resetMasterForm();
                  }}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                {(activeTab === 'packages' || activeTab === 'booster-matrix') ? (
                  <PackageForm formData={formData} setFormData={setFormData} editingId={editingId} isSuperAdmin={isSuperAdmin} isAdminManager={isAdminManager} branches={branches} boosterTypes={boosterTypes} serviceTypes={serviceTypes} setActiveTab={setActiveTab} setMasterTab={setMasterTab} setShowModal={setShowModal} />
                ) : activeTab === 'addons' ? (
                  <AddonForm addonFormData={addonFormData} setAddonFormData={setAddonFormData} editingId={editingId} />
                ) : (
                  <MasterForm masterFormData={masterFormData} setMasterFormData={setMasterFormData} editingId={editingId} masterTab={masterTab} />
                )}
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                <button onClick={() => { setShowModal(false); if (activeTab === 'packages' || activeTab === 'booster-matrix') resetForm(); else if (activeTab === 'addons') resetAddonForm(); else resetMasterForm(); }} className="flex-1 px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">Batal</button>
                <button onClick={() => { if (activeTab === 'packages' || activeTab === 'booster-matrix') handleSubmit(); else if (activeTab === 'addons') handleAddonSubmit(); else handleMasterSubmit(); }} disabled={submitting} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function BoosterMatrixTab({ boosterTypes, serviceTypes, pricings, branches, selectedBranchFilter, setSelectedBranchFilter, canManage, submitting, handleBulkCreateBooster, handleEdit, setFormData, setEditingId, setShowModal }: any) {
  const activeBoosterTypes = boosterTypes.filter((bt: MasterBoosterType) => bt.isActive);
  const activeServiceTypes = serviceTypes.filter((st: MasterServiceType) => st.isActive);

  if (activeBoosterTypes.length === 0 || activeServiceTypes.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
        <Zap className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Belum ada data master</h3>
        <p className="text-neutral-500 dark:text-neutral-400">Silakan tambahkan Tipe Booster dan Tipe Layanan di tab Master Data terlebih dahulu</p>
      </div>
    );
  }

  const currentBranchId = selectedBranchFilter === 'global' ? null : selectedBranchFilter;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/5 dark:from-purple-500/20 dark:to-violet-500/10 rounded-2xl border border-purple-500/20 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">Harga Booster Per Cabang</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Kelola harga booster untuk setiap kombinasi Tipe Booster × Tipe Layanan</p>
          </div>
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="px-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium min-w-[220px]"
          >
            <option value="global">🌐 Global (Semua Cabang)</option>
            {branches.map((branch: any) => (
              <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-700 min-w-[200px]">Tipe Booster</th>
                {activeServiceTypes.map((st: MasterServiceType) => (
                  <th key={st.id} className="px-4 py-3 text-center text-sm font-semibold text-neutral-900 dark:text-white border-b border-l border-neutral-200 dark:border-neutral-700 min-w-[140px]">
                    <div>{st.code}</div>
                    <div className="text-xs font-normal text-neutral-500 mt-0.5">{st.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeBoosterTypes.map((bt: MasterBoosterType, idx: number) => {
                const missingCount = activeServiceTypes.filter((st: MasterServiceType) =>
                  !pricings.find((p: PackagePricing) => p.packageType === 'BOOSTER' && p.boosterType === bt.code && p.serviceType === st.code && p.branchId === currentBranchId)
                ).length;
                return (
                  <tr key={bt.id} className={idx % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50/50 dark:bg-neutral-800/30'}>
                    <td className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{bt.icon || '🚀'}</span>
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-white">{bt.code}</div>
                            <div className="text-xs text-neutral-500">{bt.name}</div>
                          </div>
                        </div>
                        {canManage && missingCount > 0 && (
                          <button onClick={() => handleBulkCreateBooster(bt.code, bt.name)} disabled={submitting} className="px-2 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                            +{missingCount}
                          </button>
                        )}
                      </div>
                    </td>
                    {activeServiceTypes.map((st: MasterServiceType) => {
                      const pricing = pricings.find((p: PackagePricing) => p.packageType === 'BOOSTER' && p.boosterType === bt.code && p.serviceType === st.code && p.branchId === currentBranchId);
                      const globalPricing = selectedBranchFilter !== 'global' ? pricings.find((p: PackagePricing) => p.packageType === 'BOOSTER' && p.boosterType === bt.code && p.serviceType === st.code && p.branchId === null) : null;
                      return (
                        <td
                          key={`${bt.id}-${st.id}`}
                          onClick={() => {
                            if (pricing) handleEdit(pricing);
                            else {
                              const branchInfo = selectedBranchFilter === 'global' ? null : branches.find((b: any) => b.id === selectedBranchFilter);
                              setFormData({
                                packageType: 'BOOSTER', boosterType: bt.code, serviceType: st.code,
                                name: `Booster ${bt.code} 1X - ${st.code}${branchInfo ? ` (${branchInfo.branchCode})` : ''}`,
                                totalSessions: 1, price: globalPricing?.price || 0,
                                productCode: `BST-${bt.code}-1X-${st.code}${branchInfo ? `-${branchInfo.branchCode}` : ''}`,
                                branchId: selectedBranchFilter === 'global' ? '' : selectedBranchFilter, isActive: true
                              });
                              setEditingId(null);
                              setShowModal(true);
                            }
                          }}
                          className="px-4 py-3 text-center border-b border-l border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          {pricing ? (
                            <div>
                              <div className={`text-sm font-semibold ${selectedBranchFilter === 'global' ? 'text-emerald-600' : 'text-blue-600'}`}>{formatCurrency(pricing.price)}</div>
                              <div className={`text-xs ${pricing.isActive ? 'text-emerald-500' : 'text-red-500'}`}>{pricing.isActive ? '✓ Aktif' : '✗ Nonaktif'}</div>
                            </div>
                          ) : (
                            <div>
                              <Plus className="h-5 w-5 text-neutral-400 mx-auto" />
                              {globalPricing && <div className="text-xs text-neutral-400 mt-1">Global: {formatCurrency(globalPricing.price)}</div>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Keterangan</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><span className="text-emerald-600 font-semibold">Hijau</span><span className="text-neutral-500">= Harga Global</span></div>
            <div className="flex items-center gap-2"><span className="text-blue-600 font-semibold">Biru</span><span className="text-neutral-500">= Harga Spesifik Cabang</span></div>
            <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-neutral-400" /><span className="text-neutral-500">= Klik untuk tambah harga</span></div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Statistik</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-neutral-500">Total Kombinasi:</span><span className="font-semibold text-neutral-900 dark:text-white">{activeBoosterTypes.length} × {activeServiceTypes.length} = {activeBoosterTypes.length * activeServiceTypes.length}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Harga Tersedia:</span><span className="font-semibold text-neutral-900 dark:text-white">{pricings.filter((p: PackagePricing) => p.packageType === 'BOOSTER' && p.branchId === currentBranchId).length}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Belum Ada Harga:</span><span className="font-semibold text-amber-500">{(activeBoosterTypes.length * activeServiceTypes.length) - pricings.filter((p: PackagePricing) => p.packageType === 'BOOSTER' && p.branchId === currentBranchId).length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PackagesTab({ filteredPricings, groupedByBranch, canManage, handleEdit, handleToggleActive, handleDelete }: any) {
  if (filteredPricings.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
        <Package className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Belum ada harga paket</h3>
        <p className="text-neutral-500 dark:text-neutral-400">Klik tombol "Tambah Harga Paket" untuk menambahkan harga paket baru</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedByBranch).map(([branchId, branchData]: [string, any]) => {
        const basicPricings = branchData.pricings.filter((p: PackagePricing) => p.packageType === 'BASIC');
        return (
          <div key={branchId} className="space-y-4">
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-orange-500/5 dark:from-amber-500/20 dark:to-orange-500/10 rounded-xl border border-amber-500/20 px-4 py-3">
              <div className="flex items-center gap-2">
                {branchId === 'global' ? <Globe className="h-5 w-5 text-amber-500" /> : <Building2 className="h-5 w-5 text-amber-500" />}
                <h3 className="font-semibold text-neutral-900 dark:text-white">{branchData.branchName}{branchData.branchCode && ` (${branchData.branchCode})`}</h3>
              </div>
              <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-semibold rounded-full">{branchData.pricings.length} paket</span>
            </div>
            {basicPricings.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2"><Package className="h-4 w-4" /> Paket Terapi Basic</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {basicPricings.map((pricing: PackagePricing) => (
                    <PricingCard key={pricing.id} pricing={pricing} canManage={canManage} handleEdit={handleEdit} handleToggleActive={handleToggleActive} handleDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PricingCard({ pricing, canManage, handleEdit, handleToggleActive, handleDelete }: any) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-amber-500/50 hover:shadow-lg transition-all">
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${pricing.packageType === 'BASIC' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'}`}>
            {pricing.packageType === 'BASIC' ? '📦 BASIC' : '🚀 BOOSTER'}
          </span>
          <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${pricing.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
            {pricing.isActive ? '✓ Aktif' : '✗ Nonaktif'}
          </span>
        </div>
        <h4 className="font-semibold text-neutral-900 dark:text-white">{pricing.name}</h4>
        {pricing.productCode && <p className="text-xs text-neutral-500 font-mono mt-1">{pricing.productCode}</p>}
      </div>
      <div className="p-4 space-y-3">
        <div>
          <span className="text-xs text-neutral-500 uppercase tracking-wide">Harga</span>
          <div className="text-xl font-bold text-amber-500">{formatCurrency(pricing.price)}</div>
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
          <span className="text-sm text-neutral-500">Jumlah Sesi</span>
          <span className="font-semibold text-neutral-900 dark:text-white">{pricing.totalSessions} sesi</span>
        </div>
      </div>
      {canManage && (
        <div className="flex gap-2 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
          <button onClick={() => handleEdit(pricing)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit2 className="h-4 w-4" /> Edit</button>
          <button onClick={() => handleToggleActive(pricing)} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pricing.isActive ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}>{pricing.isActive ? <><Lock className="h-4 w-4" /> Off</> : <><Unlock className="h-4 w-4" /> On</>}</button>
          <button onClick={() => handleDelete(pricing.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /> Hapus</button>
        </div>
      )}
    </div>
  );
}

function AddonsTab({ products, canManageAddons, handleEditAddon, handleToggleAddonActive, handleDeleteAddon }: any) {
  if (products.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
        <Droplets className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Belum ada add-on</h3>
        <p className="text-neutral-500 dark:text-neutral-400">Klik tombol "Tambah Add-on" untuk menambahkan produk add-on baru</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {['AIR_NANO', 'ROKOK_KENKOU'].map((productType) => {
        const typeProducts = products.filter((p: NonTherapyProduct) => p.productType === productType);
        if (typeProducts.length === 0) return null;
        const typeIcon = productType === 'AIR_NANO' ? <Droplets className="h-5 w-5 text-cyan-500" /> : <Cigarette className="h-5 w-5 text-orange-500" />;
        const typeName = productType === 'AIR_NANO' ? 'Air Nano' : 'Rokok Kenkou';
        return (
          <div key={productType} className="space-y-4">
            <div className="flex items-center justify-between bg-gradient-to-r from-cyan-500/10 to-blue-500/5 dark:from-cyan-500/20 dark:to-blue-500/10 rounded-xl border border-cyan-500/20 px-4 py-3">
              <div className="flex items-center gap-2">{typeIcon}<h3 className="font-semibold text-neutral-900 dark:text-white">{typeName}</h3></div>
              <span className="px-3 py-1 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-sm font-semibold rounded-full">{typeProducts.length} produk</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {typeProducts.map((product: NonTherapyProduct) => (
                <AddonCard key={product.id} product={product} canManageAddons={canManageAddons} handleEditAddon={handleEditAddon} handleToggleAddonActive={handleToggleAddonActive} handleDeleteAddon={handleDeleteAddon} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddonCard({ product, canManageAddons, handleEditAddon, handleToggleAddonActive, handleDeleteAddon }: any) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-cyan-500/50 hover:shadow-lg transition-all">
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${product.productType === 'AIR_NANO' ? 'bg-cyan-500/10 text-cyan-600' : 'bg-orange-500/10 text-orange-600'}`}>
            {product.productType === 'AIR_NANO' ? '💧 AIR NANO' : '🚬 ROKOK'}
          </span>
          <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${product.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
            {product.isActive ? '✓ Aktif' : '✗ Nonaktif'}
          </span>
        </div>
        <h4 className="font-semibold text-neutral-900 dark:text-white">{product.name}</h4>
        {product.productCode && <p className="text-xs text-neutral-500 font-mono mt-1">{product.productCode}</p>}
        {product.description && <p className="text-xs text-neutral-500 mt-2">{product.description}</p>}
      </div>
      <div className="p-4 space-y-3">
        {product.productType === 'AIR_NANO' && (
          <div className="grid grid-cols-3 gap-2 p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-xs">
            <div><span className="text-neutral-500">Warna:</span><span className="ml-1 font-semibold">{product.airNanoColor === 'KUNING' ? '🟡' : product.airNanoColor === 'BIRU' ? '🔵' : '🟢'}</span></div>
            <div><span className="text-neutral-500">Vol:</span><span className="ml-1 font-semibold">{product.airNanoVolume === 'ML_600' ? '600ml' : '1500ml'}</span></div>
            <div><span className="text-neutral-500">Unit:</span><span className="ml-1 font-semibold">{product.airNanoUnit}</span></div>
          </div>
        )}
        <div>
          <span className="text-xs text-neutral-500 uppercase tracking-wide">Harga per Unit</span>
          <div className="text-xl font-bold text-cyan-500">{formatCurrency(product.pricePerUnit)}</div>
        </div>
      </div>
      {canManageAddons && (
        <div className="flex gap-2 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
          <button onClick={() => handleEditAddon(product)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit2 className="h-4 w-4" /> Edit</button>
          <button onClick={() => handleToggleAddonActive(product)} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${product.isActive ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}>{product.isActive ? <><Lock className="h-4 w-4" /> Off</> : <><Unlock className="h-4 w-4" /> On</>}</button>
          <button onClick={() => handleDeleteAddon(product.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /> Hapus</button>
        </div>
      )}
    </div>
  );
}

function MasterDataTab({ masterTab, setMasterTab, boosterTypes, serviceTypes, isSuperAdmin, handleEditMaster, handleToggleMasterActive, handleDeleteMaster }: any) {
  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 bg-white dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 w-fit">
        <button onClick={() => setMasterTab('booster')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${masterTab === 'booster' ? 'bg-purple-500 text-white' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}><Zap className="h-4 w-4" /> Tipe Booster</button>
        <button onClick={() => setMasterTab('service')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${masterTab === 'service' ? 'bg-purple-500 text-white' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}><Building2 className="h-4 w-4" /> Tipe Layanan</button>
      </div>

      {masterTab === 'booster' ? (
        boosterTypes.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
            <Zap className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Belum ada tipe booster</h3>
            <p className="text-neutral-500 dark:text-neutral-400">Klik tombol "Tambah Tipe Booster" untuk menambahkan tipe booster baru</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boosterTypes.map((type: MasterBoosterType) => (
              <MasterCard key={type.id} type={type} isSuperAdmin={isSuperAdmin} handleEditMaster={handleEditMaster} handleToggleMasterActive={handleToggleMasterActive} handleDeleteMaster={handleDeleteMaster} isBooster />
            ))}
          </div>
        )
      ) : (
        serviceTypes.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
            <Building2 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Belum ada tipe layanan</h3>
            <p className="text-neutral-500 dark:text-neutral-400">Klik tombol "Tambah Tipe Layanan" untuk menambahkan tipe layanan baru</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {serviceTypes.map((type: MasterServiceType) => (
              <MasterCard key={type.id} type={type} isSuperAdmin={isSuperAdmin} handleEditMaster={handleEditMaster} handleToggleMasterActive={handleToggleMasterActive} handleDeleteMaster={handleDeleteMaster} isBooster={false} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function MasterCard({ type, isSuperAdmin, handleEditMaster, handleToggleMasterActive, handleDeleteMaster, isBooster }: any) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-purple-500/50 hover:shadow-lg transition-all">
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${isBooster ? 'bg-purple-500/10 text-purple-600' : 'bg-blue-500/10 text-blue-600'}`}>
            {isBooster ? `${type.icon || '🚀'} ${type.code}` : `🏥 ${type.code}`}
          </span>
          <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${type.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
            {type.isActive ? '✓ Aktif' : '✗ Nonaktif'}
          </span>
        </div>
        <h4 className="font-semibold text-neutral-900 dark:text-white">{type.name}</h4>
        {type.description && <p className="text-xs text-neutral-500 mt-2">{type.description}</p>}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
          <span className="text-sm text-neutral-500">Urutan</span>
          <span className="font-semibold text-neutral-900 dark:text-white">#{type.sortOrder}</span>
        </div>
        {!isBooster && type.price && (
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
            <span className="text-sm text-neutral-500">Harga Default</span>
            <span className="font-bold text-emerald-600">{formatCurrency(type.price)}</span>
          </div>
        )}
      </div>
      {isSuperAdmin && (
        <div className="flex gap-2 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
          <button onClick={() => handleEditMaster(type)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit2 className="h-4 w-4" /> Edit</button>
          <button onClick={() => handleToggleMasterActive(type)} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${type.isActive ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}>{type.isActive ? <><Lock className="h-4 w-4" /> Off</> : <><Unlock className="h-4 w-4" /> On</>}</button>
          <button onClick={() => handleDeleteMaster(type)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /> Hapus</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function PackageForm({ formData, setFormData, editingId, isSuperAdmin, isAdminManager, branches, boosterTypes, serviceTypes, setActiveTab, setMasterTab, setShowModal }: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Tipe Paket</label>
        <select
          value={formData.packageType}
          onChange={(e) => {
            const newType = e.target.value as 'BASIC' | 'BOOSTER';
            setFormData({ ...formData, packageType: newType, boosterType: newType === 'BASIC' ? '' : formData.boosterType, serviceType: newType === 'BASIC' ? '' : formData.serviceType, totalSessions: newType === 'BASIC' ? 7 : 1 });
          }}
          className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="BASIC">📦 BASIC (Terapi Nano Bubble)</option>
          <option value="BOOSTER">🚀 BOOSTER (Tambahan Terapi)</option>
        </select>
        <p className="text-xs text-neutral-500 mt-1">{formData.packageType === 'BASIC' ? 'Paket terapi utama dengan berbagai jumlah sesi' : 'Paket booster dengan berbagai tipe dan layanan'}</p>
      </div>

      {formData.packageType === 'BOOSTER' && (
        <>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Tipe Booster *</label>
            <select
              value={formData.boosterType}
              onChange={(e) => {
                if (e.target.value === '__ADD_NEW__') { setActiveTab('master'); setMasterTab('booster'); setShowModal(false); }
                else setFormData({ ...formData, boosterType: e.target.value });
              }}
              className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="">-- Pilih Tipe Booster --</option>
              <option value="NO">🔵 NO - Nitric Oxide</option>
              <option value="GT">💚 GT - Glutathione</option>
              <option value="MB">🔷 MB - Methylene Blue</option>
              <option value="KCL">⚪ KCL - Potassium Chloride</option>
              <option value="H2S">🟡 H2S - Hydrogen Sulfide</option>
              <option value="HK">🔴 HK - Hypochlorous Acid</option>
              <option value="O3">🌀 O3 - Ozone</option>
              {boosterTypes.filter((bt: MasterBoosterType) => bt.isActive && !['NO', 'GT', 'MB', 'KCL', 'H2S', 'HK', 'O3'].includes(bt.code)).map((bt: MasterBoosterType) => (
                <option key={bt.id} value={bt.code}>{bt.icon || '🚀'} {bt.code} - {bt.name}</option>
              ))}
              {!editingId && <option value="__ADD_NEW__">➕ Tambah Tipe Booster Baru</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Tipe Layanan *</label>
            <select
              value={formData.serviceType}
              onChange={(e) => {
                if (e.target.value === '__ADD_NEW__') { setActiveTab('master'); setMasterTab('service'); setShowModal(false); }
                else setFormData({ ...formData, serviceType: e.target.value });
              }}
              className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="">-- Pilih Tipe Layanan --</option>
              <option value="PM">PM - Premier (Rp 1.000.000)</option>
              <option value="PS">PS - Partnership (Rp 650.000)</option>
              <option value="PTY">PTY - Partnership Attiya (Rp 600.000)</option>
              <option value="PDA">PDA - Partnership Dr. Abhi (Rp 65.000/ml)</option>
              <option value="PHC">PHC - Partnership Homecare (Rp 750.000)</option>
              {serviceTypes.filter((st: MasterServiceType) => st.isActive && !['PM', 'PS', 'PTY', 'PDA', 'PHC'].includes(st.code)).map((st: MasterServiceType) => (
                <option key={st.id} value={st.code}>{st.code} - {st.name}</option>
              ))}
              {!editingId && <option value="__ADD_NEW__">➕ Tambah Tipe Layanan Baru</option>}
            </select>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Nama Paket *</label>
        <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Contoh: Terapi Nano Bubble 7X" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
      </div>

      {!editingId && (isSuperAdmin || isAdminManager) && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Cabang (Opsional)</label>
          <select value={formData.branchId} onChange={(e) => setFormData({ ...formData, branchId: e.target.value })} className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50">
            <option value="">🌐 Global (Semua Cabang)</option>
            {branches.map((branch: any) => (<option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>))}
          </select>
          <p className="text-xs text-neutral-500 mt-1">Pilih cabang spesifik atau biarkan kosong untuk harga global</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Kode Produk (Opsional)</label>
        <input type="text" value={formData.productCode} onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} placeholder="Contoh: TNB-P7-PM" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Jumlah Sesi</label>
          <input type="number" value={formData.totalSessions} onChange={(e) => setFormData({ ...formData, totalSessions: parseInt(e.target.value) || 0 })} min="1" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Harga (Rp)</label>
          <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })} min="0" step="100000" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
          <p className="text-xs text-amber-500 font-medium mt-1">{formatCurrency(formData.price)}</p>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-5 h-5 rounded border-neutral-300 text-amber-500 focus:ring-amber-500" />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Aktif</span>
      </label>
    </div>
  );
}

function AddonForm({ addonFormData, setAddonFormData, editingId }: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Tipe Produk</label>
        <select
          value={addonFormData.productType}
          onChange={(e) => setAddonFormData({ ...addonFormData, productType: e.target.value, airNanoColor: '', airNanoVolume: '', airNanoUnit: '' })}
          disabled={!!editingId}
          className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
        >
          <option value="AIR_NANO">💧 Air Nano</option>
          <option value="ROKOK_KENKOU">🚬 Rokok Kenkou</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Kode Produk *</label>
        <input type="text" value={addonFormData.productCode} onChange={(e) => setAddonFormData({ ...addonFormData, productCode: e.target.value })} placeholder="Contoh: AN-KUNING-600ML" disabled={!!editingId} className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50" />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Nama Produk *</label>
        <input type="text" value={addonFormData.name} onChange={(e) => setAddonFormData({ ...addonFormData, name: e.target.value })} placeholder="Contoh: Air Nano Kuning 600ml" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Deskripsi (Opsional)</label>
        <textarea value={addonFormData.description} onChange={(e) => setAddonFormData({ ...addonFormData, description: e.target.value })} placeholder="Deskripsi produk..." rows={2} className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none" />
      </div>

      {addonFormData.productType === 'AIR_NANO' && !editingId && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Warna *</label>
            <select value={addonFormData.airNanoColor} onChange={(e) => setAddonFormData({ ...addonFormData, airNanoColor: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm">
              <option value="">Pilih</option>
              <option value="KUNING">🟡 Kuning</option>
              <option value="BIRU">🔵 Biru</option>
              <option value="HIJAU">🟢 Hijau</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Volume *</label>
            <select value={addonFormData.airNanoVolume} onChange={(e) => setAddonFormData({ ...addonFormData, airNanoVolume: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm">
              <option value="">Pilih</option>
              <option value="ML_600">600ml</option>
              <option value="ML_1500">1500ml</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Unit *</label>
            <select value={addonFormData.airNanoUnit} onChange={(e) => setAddonFormData({ ...addonFormData, airNanoUnit: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm">
              <option value="">Pilih</option>
              <option value="BOTOL">Botol</option>
              <option value="DUS">Dus</option>
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Harga per Unit (Rp)</label>
        <input type="number" value={addonFormData.pricePerUnit} onChange={(e) => setAddonFormData({ ...addonFormData, pricePerUnit: parseInt(e.target.value) || 0 })} min="0" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        <p className="text-xs text-cyan-500 font-medium mt-1">{formatCurrency(addonFormData.pricePerUnit)}</p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={addonFormData.isActive} onChange={(e) => setAddonFormData({ ...addonFormData, isActive: e.target.checked })} className="w-5 h-5 rounded border-neutral-300 text-amber-500 focus:ring-amber-500" />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Aktif</span>
      </label>
    </div>
  );
}

function MasterForm({ masterFormData, setMasterFormData, editingId, masterTab }: any) {
  const isBooster = masterTab === 'booster';
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Kode *</label>
        <input type="text" value={masterFormData.code} onChange={(e) => setMasterFormData({ ...masterFormData, code: e.target.value.toUpperCase() })} placeholder={isBooster ? 'Contoh: NO, GT, MB' : 'Contoh: PM, PS'} disabled={!!editingId} className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 uppercase" />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Nama *</label>
        <input type="text" value={masterFormData.name} onChange={(e) => setMasterFormData({ ...masterFormData, name: e.target.value })} placeholder={isBooster ? 'Contoh: Nitric Oxide' : 'Contoh: Premier'} className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
      </div>

      {isBooster && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Icon (Emoji)</label>
          <input type="text" value={masterFormData.icon} onChange={(e) => setMasterFormData({ ...masterFormData, icon: e.target.value })} placeholder="Contoh: 🔵, 💚, 🔷" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Deskripsi (Opsional)</label>
        <textarea value={masterFormData.description} onChange={(e) => setMasterFormData({ ...masterFormData, description: e.target.value })} placeholder="Deskripsi singkat..." rows={2} className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {!isBooster && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Harga Default (Rp)</label>
            <input type="number" value={masterFormData.price} onChange={(e) => setMasterFormData({ ...masterFormData, price: parseInt(e.target.value) || 0 })} min="0" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
          </div>
        )}
        <div className={!isBooster ? '' : 'col-span-2'}>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Urutan</label>
          <input type="number" value={masterFormData.sortOrder} onChange={(e) => setMasterFormData({ ...masterFormData, sortOrder: parseInt(e.target.value) || 0 })} min="0" className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={masterFormData.isActive} onChange={(e) => setMasterFormData({ ...masterFormData, isActive: e.target.checked })} className="w-5 h-5 rounded border-neutral-300 text-amber-500 focus:ring-amber-500" />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Aktif</span>
      </label>
    </div>
  );
}
