'use client';

import { useState, useEffect } from 'react';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { doctorBranchApi } from '@/lib/api/doctorBranchApi';
import { useAuthStore } from '@/stores/authStore';
import { Package, ArrowRight, Calendar, Building2, TrendingUp, Download, Filter as FilterIcon } from 'lucide-react';

interface Shipment {
  id: string;
  shipmentCode: string;
  status: 'PENDING' | 'SHIPPED' | 'RECEIVED';
  shippedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  branchFrom: {
    id: string;
    name: string;
    branchCode: string;
  };
  branchTo: {
    id: string;
    name: string;
    branchCode: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    masterProduct: {
      name: string;
      sku: string;
    };
  }>;
  createdBy: {
    profile: {
      fullName: string;
    };
  };
}

interface ManagedBranch {
  branchId: string;
  branchName: string;
  branchCode: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu',
  SHIPPED: 'Dikirim',
  RECEIVED: 'Diterima',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  SHIPPED: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  RECEIVED: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
};

export default function BranchTransfersPage() {
  const { user } = useAuthStore();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [branches, setBranches] = useState<ManagedBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdminManager = user?.role === 'ADMIN_MANAGER';

  // Load managed branches for Admin Manager
  useEffect(() => {
    if (isAdminManager) {
      fetchBranches();
    }
  }, [isAdminManager]);

  // Load shipments
  useEffect(() => {
    fetchShipments();
  }, [branchFilter, statusFilter, startDate, endDate]);

  const fetchBranches = async () => {
    try {
      const response = await doctorBranchApi.getManagedBranches(false);
      const wrappedResponse = response as any;
      const branchesArray = wrappedResponse.data || [];
      setBranches(Array.isArray(branchesArray) ? branchesArray : []);
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([]);
    }
  };

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (branchFilter) params.branchId = branchFilter;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await inventoryApi.getShipments(params);
      const wrappedData = (response.data as any).data || response.data;
      const shipmentsArray = wrappedData.shipments || wrappedData || [];
      
      setShipments(Array.isArray(shipmentsArray) ? shipmentsArray : []);
    } catch (err) {
      console.error('Failed to load shipments:', err);
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTotalItems = (shipment: Shipment) => {
    return shipment.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Filter shipments by managed branches
  const filteredShipments = isAdminManager
    ? shipments.filter(s => 
        branches.some(b => b.branchId === s.branchFrom.id || b.branchId === s.branchTo.id)
      )
    : shipments;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30">
            <Package className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Transfer Barang Antar Cabang</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {isAdminManager ? 'Lihat transfer barang di cabang yang Anda kelola' : 'Lihat semua transfer barang antar cabang'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Branch Filter - Admin Manager only */}
            {isAdminManager && branches.length > 0 && (
              <div className="relative min-w-[200px]">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Semua Cabang</option>
                  {branches.map((branch) => (
                    <option key={branch.branchId} value={branch.branchId}>
                      {branch.branchName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="relative min-w-[180px]">
              <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">Semua Status</option>
                <option value="PENDING">Menunggu</option>
                <option value="SHIPPED">Dikirim</option>
                <option value="RECEIVED">Diterima</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 pr-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>
              <span className="text-neutral-400 text-sm">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-neutral-200 dark:border-neutral-700"></div>
              <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
            </div>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Memuat data transfer...</span>
          </div>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Package className="h-8 w-8 text-neutral-400" />
            </div>
            <div>
              <p className="text-neutral-900 dark:text-white font-semibold">Tidak ada data transfer</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Belum ada transfer barang yang sesuai dengan filter
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredShipments.map((shipment) => (
            <div
              key={shipment.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-500/20 dark:to-blue-600/20">
                    <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 dark:text-white">{shipment.shipmentCode}</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Dibuat: {formatDate(shipment.createdAt)} • {shipment.createdBy.profile.fullName}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${STATUS_COLORS[shipment.status]}`}>
                  {STATUS_LABELS[shipment.status]}
                </span>
              </div>

              {/* Branch Transfer */}
              <div className="flex items-center gap-4 mb-4 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-neutral-400" />
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Dari</span>
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-white">{shipment.branchFrom.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{shipment.branchFrom.branchCode}</p>
                </div>
                
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20">
                  <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Ke</span>
                    <Building2 className="h-4 w-4 text-neutral-400" />
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-white">{shipment.branchTo.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{shipment.branchTo.branchCode}</p>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Item yang Ditransfer ({shipment.items.length} item)</span>
                </div>
                {shipment.items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900 dark:text-white">{item.masterProduct.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.masterProduct.sku}</p>
                    </div>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {item.quantity} unit
                    </span>
                  </div>
                ))}
                {shipment.items.length > 3 && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-2">
                    + {shipment.items.length - 3} item lainnya
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <Package className="h-4 w-4" />
                  <span>Total: <strong className="text-neutral-900 dark:text-white">{getTotalItems(shipment)}</strong> unit</span>
                </div>
                {shipment.shippedAt && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Dikirim: {formatDate(shipment.shippedAt)}
                  </p>
                )}
                {shipment.receivedAt && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Diterima: {formatDate(shipment.receivedAt)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
