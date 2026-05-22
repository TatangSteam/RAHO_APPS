'use client';

import { useState, useEffect } from 'react';
import { X, Building2, Loader2, Plus, Trash2, Stethoscope, Heart, Star, ArrowUpCircle } from 'lucide-react';
import { showToast, confirm } from '@/lib/toast';
import { branchesApi } from '@/lib/api/branchesApi';
import { InfoAlert } from '@/components/ui/Alert';

interface AssignedBranch {
  staffBranchId: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  branchType: string;
  assignedAt: string;
  isPrimary: boolean;
}

interface AvailableBranch {
  id: string;
  branchCode: string;
  name: string;
  type: string;
  city: string;
}

interface StaffBranchData {
  userId: string;
  fullName: string;
  role: 'DOCTOR' | 'NURSE';
  primaryBranch: {
    id: string;
    branchCode: string;
    name: string;
  } | null;
  assignedBranches: AssignedBranch[];
}

interface ManageStaffBranchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  staffName: string;
  staffRole: 'DOCTOR' | 'NURSE';
}

export default function ManageStaffBranchesModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  staffName,
  staffRole,
}: ManageStaffBranchesModalProps) {
  const [loading, setLoading] = useState(true);
  const [staffData, setStaffData] = useState<StaffBranchData | null>(null);
  const [availableBranches, setAvailableBranches] = useState<AvailableBranch[]>([]);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [branchesRes, availableRes] = await Promise.all([
        branchesApi.getUserBranches(userId),
        branchesApi.getAvailableBranchesForUser(userId),
      ]);
      setStaffData(branchesRes.data.data);
      setAvailableBranches(availableRes.data.data || []);
    } catch (error: any) {
      console.error('Error loading staff branches:', error);
      showToast.error('Gagal memuat data cabang staff');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignBranch = async () => {
    if (!selectedBranchId) {
      showToast.error('Pilih cabang terlebih dahulu');
      return;
    }
    try {
      setAssigning(true);
      await branchesApi.assignUserToBranch(userId, selectedBranchId);
      showToast.success('Cabang berhasil ditambahkan');
      setSelectedBranchId('');
      setShowAddBranch(false);
      await loadData();
      onSuccess();
    } catch (error: any) {
      console.error('Error assigning branch:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menambahkan cabang');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveBranch = async (branchId: string, branchName: string) => {
    const confirmed = await confirm.warning(
      'Hapus dari Cabang',
      `Apakah Anda yakin ingin menghapus ${staffName} dari cabang ${branchName}?`
    );
    if (!confirmed) return;
    
    try {
      setRemoving(branchId);
      await branchesApi.removeUserFromBranch(userId, branchId);
      showToast.success(`Berhasil menghapus dari cabang ${branchName}`);
      await loadData();
      onSuccess();
    } catch (error: any) {
      console.error('Error removing branch:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menghapus dari cabang');
    } finally {
      setRemoving(null);
    }
  };

  const handleSetPrimaryBranch = async (branchId: string, branchName: string) => {
    const confirmed = await confirm.action(
      'Ubah Cabang Utama',
      `Apakah Anda yakin ingin menjadikan "${branchName}" sebagai cabang utama untuk ${staffName}?`,
      'Ya, Ubah'
    );
    if (!confirmed) return;
    
    try {
      setSettingPrimary(branchId);
      await branchesApi.setPrimaryBranch(userId, branchId);
      showToast.success(`Cabang utama berhasil diubah ke ${branchName}`);
      await loadData();
      onSuccess();
    } catch (error: any) {
      console.error('Error setting primary branch:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengubah cabang utama');
    } finally {
      setSettingPrimary(null);
    }
  };

  const getRoleIcon = () => staffRole === 'DOCTOR' ? <Stethoscope size={16} /> : <Heart size={16} />;
  const getRoleLabel = () => staffRole === 'DOCTOR' ? 'Dokter' : 'Perawat';

  const getBranchTypeStyles = (type: string) => {
    switch (type) {
      case 'PUSAT': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400';
      case 'PREMIER': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400';
      case 'PARTNERSHIP': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400';
      case 'KLINIK': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400';
      case 'HOMECARE': return 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400';
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700/50 dark:text-neutral-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 dark:bg-black/75 flex items-center justify-center z-[9999] p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b-2 border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <Building2 size={24} className="text-amber-500" />
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Kelola Cabang</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                  staffRole === 'DOCTOR' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                }`}>
                  {getRoleIcon()}
                  {getRoleLabel()}
                </span>
                <strong className="text-neutral-700 dark:text-neutral-200">{staffName}</strong>
              </div>
            </div>
          </div>
          <button className="w-9 h-9 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-4 overflow-y-auto max-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p>Memuat data cabang...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Cabang yang Di-assign ({staffData?.assignedBranches.length || 0})
                  </h3>
                  {availableBranches.length > 0 && !showAddBranch && (
                    <button onClick={() => setShowAddBranch(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors">
                      <Plus size={14} />
                      Tambah Cabang
                    </button>
                  )}
                </div>

                {showAddBranch && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl mb-3">
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">Pilih Cabang</label>
                      <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500">
                        <option value="">-- Pilih Cabang --</option>
                        {availableBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name} ({branch.city})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setShowAddBranch(false); setSelectedBranchId(''); }} className="px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">Batal</button>
                      <button onClick={handleAssignBranch} disabled={!selectedBranchId || assigning} className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                        {assigning ? (<><Loader2 size={14} className="animate-spin" />Menyimpan...</>) : (<><Plus size={14} />Tambah</>)}
                      </button>
                    </div>
                  </div>
                )}

                {staffData?.assignedBranches.length === 0 ? (
                  <div className="py-8 text-center bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-500 dark:text-neutral-400">
                    <Building2 size={32} className="mx-auto mb-3 opacity-50" />
                    <p>Belum ada cabang yang di-assign</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {staffData?.assignedBranches.map((branch) => (
                      <div key={branch.branchId} className={`flex items-center justify-between p-3.5 rounded-xl border ${branch.isPrimary ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' : 'bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getBranchTypeStyles(branch.branchType)}`}>
                            <Building2 size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-neutral-900 dark:text-white">{branch.branchName}</span>
                              {branch.isPrimary && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                  <Star size={10} />Cabang Utama
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getBranchTypeStyles(branch.branchType)}`}>{branch.branchType === 'PREMIER' ? 'Premier (Cabang)' : branch.branchType}</span>
                              <span>{branch.branchCode}</span>
                              <span>•</span>
                              <span>Sejak {new Date(branch.assignedAt).toLocaleDateString('id-ID')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!branch.isPrimary && (
                            <>
                              <button 
                                onClick={() => handleSetPrimaryBranch(branch.branchId, branch.branchName)} 
                                disabled={settingPrimary === branch.branchId} 
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed" 
                                title="Jadikan Cabang Utama"
                              >
                                {settingPrimary === branch.branchId ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
                              </button>
                              <button 
                                onClick={() => handleRemoveBranch(branch.branchId, branch.branchName)} 
                                disabled={removing === branch.branchId} 
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed" 
                                title="Hapus dari cabang"
                              >
                                {removing === branch.branchId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <InfoAlert icon={<ArrowUpCircle size={16} />}>
                Klik tombol <ArrowUpCircle size={12} className="inline mx-1" /> untuk menjadikan cabang sebagai cabang utama. Cabang utama tidak dapat dihapus dari daftar assignment.
              </InfoAlert>
            </>
          )}
        </div>

        <div className="flex justify-end gap-4 px-6 py-5 border-t-2 border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <button type="button" onClick={onClose} className="px-6 py-2.5 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-sm font-semibold hover:border-neutral-300 dark:hover:border-neutral-600 transition-all">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
