'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
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
        loadPricings(); // Load all pricings for matrix view
        loadMasterData(); // Load booster and service types
      } else if (activeTab === 'addons') {
        loadProducts();
      } else if (activeTab === 'master') {
        loadMasterData();
      }
    }
  }, [user, accessToken, activeTab]);

  // Load branches for Super Admin and Admin Manager
  useEffect(() => {
    if ((isSuperAdmin || isAdminManager) && accessToken) {
      loadBranches();
    }
  }, [isSuperAdmin, isAdminManager, accessToken]);

  // Load master data on initial load for dropdown options
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
        console.log('📦 Branches API Response:', result);
        
        // Response structure: { success: true, data: [...branches] }
        const branchesData = result.data || [];
        console.log('📋 Branches Data:', branchesData);
        
        setBranches(branchesData);
      } else {
        console.error('Failed to load branches, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
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

      if (!response.ok) {
        throw new Error('Gagal memuat data harga paket');
      }

      const data = await response.json();
      console.log('📦 Package Pricing Data:', data.data?.pricings);
      console.log('📊 Total pricings loaded:', data.data?.pricings?.length || 0);
      console.log('🚀 BOOSTER pricings:', data.data?.pricings?.filter((p: any) => p.packageType === 'BOOSTER').length || 0);
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
        console.log('🎯 Booster Types:', boosterData.data?.types);
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
        console.log('🎯 Service Types:', serviceData.data?.types);
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
        // Update - send all fields that can be changed
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

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing/${editingId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
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

        // Add branchId - priority: form selection > user's branch (for ADMIN_CABANG)
        if (formData.branchId) {
          payload.branchId = formData.branchId;
        } else if (isAdminCabang && user?.branchId) {
          payload.branchId = user.branchId;
        }
        // If no branchId, it will be a global pricing (null branchId)

        console.log('📤 Sending create pricing payload:', payload);

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
          console.error('❌ Create pricing error:', error);
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
  // BULK CREATE BOOSTER (for all service types)
  // ══════════════════════════════════════════════════════════════
  const handleBulkCreateBooster = async (boosterCode: string, boosterName: string) => {
    const currentBranchId = selectedBranchFilter === 'global' ? null : selectedBranchFilter;
    const branchInfo = currentBranchId
      ? branches.find(b => b.id === currentBranchId)
      : null;
    const branchLabel = branchInfo ? ` di cabang ${branchInfo.branchCode}` : ' (Global)';

    // Find which service types don't have pricing yet for this booster
    const activeServiceTypes = serviceTypes.filter(st => st.isActive);
    const missingServiceTypes = activeServiceTypes.filter(st => {
      return !pricings.find(p =>
        p.packageType === 'BOOSTER' &&
        p.boosterType === boosterCode &&
        p.serviceType === st.code &&
        p.branchId === currentBranchId
      );
    });

    if (missingServiceTypes.length === 0) {
      showToast.success(`Booster ${boosterCode} sudah punya semua tipe layanan${branchLabel}`);
      return;
    }

    const confirmMsg = `Buat ${missingServiceTypes.length} harga booster ${boosterCode}${branchLabel}?\n\nTipe layanan: ${missingServiceTypes.map(st => st.code).join(', ')}\n\nHarga akan diambil dari Master Tipe Layanan (atau 0 jika belum diatur).`;
    if (!confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      let successCount = 0;
      const errors: string[] = [];

      for (const st of missingServiceTypes) {
        const payload: any = {
          packageType: 'BOOSTER',
          boosterType: boosterCode,
          serviceType: st.code,
          name: `Booster ${boosterCode} 1X - ${st.code}${branchInfo ? ` (${branchInfo.branchCode})` : ''}`,
          totalSessions: 1,
          price: st.price || 0,
          productCode: `BST-${boosterCode}-1X-${st.code}${branchInfo ? `-${branchInfo.branchCode}` : ''}`,
          isActive: true,
        };
        if (currentBranchId) payload.branchId = currentBranchId;

        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/package-pricing`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            successCount++;
          } else {
            const err = await response.json();
            errors.push(`${st.code}: ${err.error?.message || 'gagal'}`);
          }
        } catch (e: any) {
          errors.push(`${st.code}: ${e.message}`);
        }
      }

      if (successCount > 0) {
        showToast.success(`Berhasil membuat ${successCount} harga booster`);
      }
      if (errors.length > 0) {
        showToast.error(`Gagal membuat ${errors.length}: ${errors.slice(0, 2).join('; ')}`);
      }
      loadPricings();
    } finally {
      setSubmitting(false);
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
        // Create
        const payload: any = {
          code: masterFormData.code.toUpperCase(),
          name: masterFormData.name,
          description: masterFormData.description || undefined,
          sortOrder: masterFormData.sortOrder,
        };

        if (isBooster) {
          payload.icon = masterFormData.icon;
        } else {
          payload.price = masterFormData.price;
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
      branchId: '',
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
      price: 0,
      sortOrder: 0,
      isActive: true
    });
  };

  // Filter pricings by selected branch
  const filteredPricings = selectedBranchFilter === 'all' 
    ? pricings 
    : pricings.filter(p => {
        if (selectedBranchFilter === 'global') {
          return !p.branchId;
        }
        return p.branchId === selectedBranchFilter;
      });

  // Group pricings by branch for display
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

  // Get unique branches for filter dropdown
  const uniqueBranches = Array.from(
    new Map(
      pricings
        .filter(p => p.branch)
        .map(p => [p.branchId, { id: p.branchId!, name: p.branch!.name, code: p.branch!.branchCode }])
    ).values()
  );
  const hasGlobalPricings = pricings.some(p => !p.branchId);

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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Branch Filter - Only show for SUPER_ADMIN and ADMIN_MANAGER on packages tab */}
          {(isSuperAdmin || isAdminManager) && activeTab === 'packages' && (
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className={styles.branchFilter}
            >
              <option value="all">🏢 Semua Cabang</option>
              {hasGlobalPricings && <option value="global">🌐 Global</option>}
              {uniqueBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </select>
          )}
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
          onClick={() => setActiveTab('booster-matrix')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'booster-matrix' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'booster-matrix' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'booster-matrix' ? '3px solid var(--color-primary)' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
        >
          🚀 Booster Matrix
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
      ) : activeTab === 'booster-matrix' ? (
        // ══════════════════════════════════════════════════════════════
        // BOOSTER MATRIX TAB
        // ══════════════════════════════════════════════════════════════
        <div>
          {/* Header & Branch Filter */}
          <div style={{ marginBottom: '24px', padding: '20px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#f1f5f9' }}>
                  🚀 Harga Booster Per Cabang
                </h3>
                <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '0' }}>
                  Kelola harga booster untuk setiap kombinasi Tipe Booster × Tipe Layanan. Pilih cabang untuk melihat harga spesifik.
                </p>
              </div>

              {/* Branch Selector */}
              <div style={{ minWidth: '250px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
                  Pilih Cabang:
                </label>
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="global">🌐 Global (Semua Cabang)</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branchCode} - {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Booster Matrix Table */}
          {boosterTypes.filter(bt => bt.isActive).length === 0 || serviceTypes.filter(st => st.isActive).length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🚀</div>
              <h3>Belum ada data master</h3>
              <p>Silakan tambahkan Tipe Booster dan Tipe Layanan di tab Master Data terlebih dahulu</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: '#1e293b',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      <th style={{
                        padding: '16px',
                        textAlign: 'left',
                        borderBottom: '2px solid #334155',
                        color: '#f1f5f9',
                        fontWeight: '600',
                        minWidth: '200px'
                      }}>
                        Tipe Booster
                      </th>
                      {serviceTypes.filter(st => st.isActive).map((st) => (
                        <th key={st.id} style={{
                          padding: '16px',
                          textAlign: 'center',
                          borderBottom: '2px solid #334155',
                          borderLeft: '1px solid #334155',
                          color: '#f1f5f9',
                          fontWeight: '600',
                          minWidth: '150px'
                        }}>
                          <div>{st.code}</div>
                          <div style={{ fontSize: '12px', fontWeight: '400', color: '#94a3b8', marginTop: '4px' }}>
                            {st.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boosterTypes.filter(bt => bt.isActive).map((bt, btIndex) => (
                      <tr key={bt.id} style={{
                        background: btIndex % 2 === 0 ? '#1e293b' : '#0f172a'
                      }}>
                        <td style={{
                          padding: '16px',
                          borderBottom: '1px solid #334155',
                          color: '#f1f5f9',
                          fontWeight: '600'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '20px' }}>{bt.icon || '🚀'}</span>
                              <div>
                                <div>{bt.code}</div>
                                <div style={{ fontSize: '12px', fontWeight: '400', color: '#94a3b8' }}>
                                  {bt.name}
                                </div>
                              </div>
                            </div>
                            {canManage && (() => {
                              const currentBranchId = selectedBranchFilter === 'global' ? null : selectedBranchFilter;
                              const activeSvc = serviceTypes.filter(s => s.isActive);
                              const missingCount = activeSvc.filter(st =>
                                !pricings.find(p =>
                                  p.packageType === 'BOOSTER' &&
                                  p.boosterType === bt.code &&
                                  p.serviceType === st.code &&
                                  p.branchId === currentBranchId
                                )
                              ).length;
                              if (missingCount === 0) return null;
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBulkCreateBooster(bt.code, bt.name);
                                  }}
                                  disabled={submitting}
                                  title={`Buat ${missingCount} harga sekaligus untuk semua tipe layanan`}
                                  style={{
                                    padding: '4px 10px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.6 : 1,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  ⚡ +{missingCount} Semua
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                        {serviceTypes.filter(st => st.isActive).map((st) => {
                          const currentBranchId = selectedBranchFilter === 'global' ? null : selectedBranchFilter;
                          const pricing = pricings.find(p =>
                            p.packageType === 'BOOSTER' &&
                            p.boosterType === bt.code &&
                            p.serviceType === st.code &&
                            p.branchId === currentBranchId
                          );

                          const globalPricing = selectedBranchFilter !== 'global' ? pricings.find(p =>
                            p.packageType === 'BOOSTER' &&
                            p.boosterType === bt.code &&
                            p.serviceType === st.code &&
                            p.branchId === null
                          ) : null;

                          return (
                            <td
                              key={`${bt.id}-${st.id}`}
                              onClick={() => {
                                if (pricing) {
                                  handleEdit(pricing);
                                } else {
                                  const branchInfo = selectedBranchFilter === 'global'
                                    ? { id: '', code: '', branchCode: '' }
                                    : branches.find(b => b.id === selectedBranchFilter) || { id: '', code: '', branchCode: '' };

                                  setFormData({
                                    packageType: 'BOOSTER',
                                    boosterType: bt.code as any,
                                    serviceType: st.code as any,
                                    name: `Booster ${bt.code} 1X - ${st.code}${branchInfo.branchCode ? ` (${branchInfo.branchCode})` : ''}`,
                                    totalSessions: 1,
                                    price: globalPricing?.price || 0,
                                    productCode: `BST-${bt.code}-1X-${st.code}${branchInfo.branchCode ? `-${branchInfo.branchCode}` : ''}`,
                                    branchId: selectedBranchFilter === 'global' ? '' : selectedBranchFilter,
                                    isActive: true
                                  });
                                  setEditingId(null);
                                  setShowModal(true);
                                }
                              }}
                              style={{
                                padding: '16px',
                                textAlign: 'center',
                                borderBottom: '1px solid #334155',
                                borderLeft: '1px solid #334155',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#334155';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {pricing ? (
                                <div>
                                  <div style={{
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: selectedBranchFilter === 'global' ? '#10b981' : '#3b82f6',
                                    marginBottom: '4px'
                                  }}>
                                    {formatCurrency(pricing.price)}
                                  </div>
                                  {pricing.isActive ? (
                                    <div style={{ fontSize: '11px', color: '#10b981' }}>✓ Aktif</div>
                                  ) : (
                                    <div style={{ fontSize: '11px', color: '#ef4444' }}>✗ Nonaktif</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div style={{ fontSize: '24px', color: '#64748b', marginBottom: '4px' }}>➕</div>
                                  {globalPricing && selectedBranchFilter !== 'global' && (
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                      Global: {formatCurrency(globalPricing.price)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info & Legend */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#f1f5f9' }}>
                    📖 Keterangan:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#10b981', fontSize: '14px', fontWeight: '600' }}>Hijau</span>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>= Harga Global</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#3b82f6', fontSize: '14px', fontWeight: '600' }}>Biru</span>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>= Harga Spesifik Cabang</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '600' }}>➕</span>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>= Klik untuk tambah harga</span>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#f1f5f9' }}>
                    📊 Statistik:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Total Kombinasi:</span>
                      <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: '600' }}>
                        {boosterTypes.filter(bt => bt.isActive).length} × {serviceTypes.filter(st => st.isActive).length} = {boosterTypes.filter(bt => bt.isActive).length * serviceTypes.filter(st => st.isActive).length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Harga Tersedia:</span>
                      <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: '600' }}>
                        {pricings.filter(p =>
                          p.packageType === 'BOOSTER' &&
                          p.branchId === (selectedBranchFilter === 'global' ? null : selectedBranchFilter)
                        ).length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Belum Ada Harga:</span>
                      <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>
                        {(boosterTypes.filter(bt => bt.isActive).length * serviceTypes.filter(st => st.isActive).length) -
                         pricings.filter(p =>
                           p.packageType === 'BOOSTER' &&
                           p.branchId === (selectedBranchFilter === 'global' ? null : selectedBranchFilter)
                         ).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : activeTab === 'packages' ? (
        filteredPricings.length === 0 ? (
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

              </div>
            );
          })}
        </div>
        )
      ) : activeTab === 'addons' ? (
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
      ) : null}

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Urutan:</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          #{type.sortOrder}
                        </span>
                      </div>
                      {type.price && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Harga Default:</span>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>
                            {formatCurrency(type.price)}
                          </span>
                        </div>
                      )}
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
              if (activeTab === 'packages' || activeTab === 'booster-matrix') {
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
                {activeTab === 'packages' || activeTab === 'booster-matrix'
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
                  if (activeTab === 'packages' || activeTab === 'booster-matrix') {
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
              {activeTab === 'packages' || activeTab === 'booster-matrix' ? (
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
                    >
                      <option value="BASIC">📦 BASIC (Terapi Nano Bubble)</option>
                      <option value="BOOSTER">🚀 BOOSTER (Tambahan Terapi)</option>
                    </select>
                    <p className={styles.formHint}>
                      {formData.packageType === 'BASIC' 
                        ? 'Paket terapi utama dengan berbagai jumlah sesi (1X, 7X, 15X, dll)'
                        : 'Paket booster dengan 7 tipe (NO, GT, MB, KCL, H2S, HK, O3) dan 5 tipe layanan (PM, PS, PTY, PDA, PHC)'}
                    </p>
                    {editingId && (
                      <p className={styles.formHint} style={{ color: '#f59e0b', fontWeight: '600' }}>
                        ⚠️ Perubahan tidak akan mempengaruhi paket yang sudah dimiliki member
                      </p>
                    )}
                  </div>

                  {formData.packageType === 'BOOSTER' && (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Tipe Booster *</label>
                        <select
                          value={formData.boosterType}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '__ADD_NEW__') {
                              // Redirect to Master Data tab to add new booster type
                              setActiveTab('master');
                              setMasterTab('booster');
                              setShowModal(false);
                            } else {
                              setFormData({ ...formData, boosterType: value as any });
                            }
                          }}
                          className={styles.formInput}
                        >
                          <option value="">-- Pilih Tipe Booster --</option>
                          
                          {/* Hardcoded default options */}
                          <option value="NO">🔵 NO - Nitric Oxide</option>
                          <option value="GT">💚 GT - Glutathione</option>
                          <option value="MB">🔷 MB - Methylene Blue</option>
                          <option value="KCL">⚪ KCL - Potassium Chloride</option>
                          <option value="H2S">🟡 H2S - Hydrogen Sulfide</option>
                          <option value="HK">🔴 HK - Hypochlorous Acid</option>
                          <option value="O3">🌀 O3 - Ozone</option>
                          
                          {/* Additional options from master data (if any) */}
                          {boosterTypes.filter(bt => 
                            bt.isActive && 
                            !['NO', 'GT', 'MB', 'KCL', 'H2S', 'HK', 'O3'].includes(bt.code)
                          ).map((bt) => (
                            <option key={bt.id} value={bt.code}>
                              {bt.icon || '🚀'} {bt.code} - {bt.name}
                            </option>
                          ))}
                          
                          {!editingId && (
                            <option value="__ADD_NEW__" style={{ borderTop: '2px solid #3b82f6', marginTop: '4px', fontWeight: '700', color: '#60a5fa' }}>
                              ➕ Tambah Tipe Booster Baru
                            </option>
                          )}
                        </select>
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Tipe Layanan *</label>
                        <select
                          value={formData.serviceType}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '__ADD_NEW__') {
                              // Redirect to Master Data tab to add new service type
                              setActiveTab('master');
                              setMasterTab('service');
                              setShowModal(false);
                            } else {
                              setFormData({ ...formData, serviceType: value as any });
                            }
                          }}
                          className={styles.formInput}
                        >
                          <option value="">-- Pilih Tipe Layanan --</option>
                          
                          {/* Hardcoded default options */}
                          <option value="PM">PM - Premier (Rp 1.000.000)</option>
                          <option value="PS">PS - Partnership (Rp 650.000)</option>
                          <option value="PTY">PTY - Partnership Attiya (Rp 600.000)</option>
                          <option value="PDA">PDA - Partnership Dr. Abhi (Rp 65.000/ml)</option>
                          <option value="PHC">PHC - Partnership Homecare (Rp 750.000)</option>
                          
                          {/* Additional options from master data (if any) */}
                          {serviceTypes.filter(st => 
                            st.isActive && 
                            !['PM', 'PS', 'PTY', 'PDA', 'PHC'].includes(st.code)
                          ).map((st) => (
                            <option key={st.id} value={st.code}>
                              {st.code} - {st.name}
                            </option>
                          ))}
                          
                          {!editingId && (
                            <option value="__ADD_NEW__" style={{ borderTop: '2px solid #3b82f6', marginTop: '4px', fontWeight: '700', color: '#60a5fa' }}>
                              ➕ Tambah Tipe Layanan Baru
                            </option>
                          )}
                        </select>
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
                    />
                  </div>

                  {/* Branch Selection - Only for SUPER_ADMIN and ADMIN_MANAGER when creating */}
                  {!editingId && (isSuperAdmin || isAdminManager) && (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Cabang (Opsional)</label>
                      <select
                        value={formData.branchId}
                        onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                        className={styles.formInput}
                      >
                        <option value="">🌐 Global (Semua Cabang)</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.branchCode} - {branch.name}
                          </option>
                        ))}
                      </select>
                      <p className={styles.formHint}>
                        Pilih cabang spesifik atau biarkan kosong untuk harga global yang berlaku di semua cabang
                      </p>
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Kode Produk (Opsional)</label>
                    <input
                      type="text"
                      value={formData.productCode}
                      onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                      className={styles.formInput}
                      placeholder="Contoh: TNB-P7-PM"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Jumlah Sesi</label>
                    <input
                      type="number"
                      value={formData.totalSessions}
                      onChange={(e) => setFormData({ ...formData, totalSessions: parseInt(e.target.value) || 0 })}
                      className={styles.formInput}
                      min="1"
                    />
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
                      placeholder={masterTab === 'booster' ? 'Contoh: Nitric Oxide' : 'Contoh: Premier'}
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

                  {masterTab === 'service' && (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Harga (Opsional)</label>
                      <input
                        type="number"
                        value={masterFormData.price}
                        onChange={(e) => setMasterFormData({ ...masterFormData, price: parseFloat(e.target.value) || 0 })}
                        className={styles.formInput}
                        placeholder="Contoh: 1000000"
                        min="0"
                        step="10000"
                      />
                      <p className={styles.formHint}>Harga default untuk tipe layanan ini (dalam Rupiah). Preview: {formatCurrency(masterFormData.price)}</p>
                    </div>
                  )}

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
                  if (activeTab === 'packages' || activeTab === 'booster-matrix') {
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
                onClick={(activeTab === 'packages' || activeTab === 'booster-matrix') ? handleSubmit : activeTab === 'addons' ? handleAddonSubmit : handleMasterSubmit}
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
