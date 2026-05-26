'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Search, Loader2, Stethoscope, Heart, Building2, Check } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { branchesApi } from '@/lib/api/branchesApi';
import { devError } from '@/lib/logger';

interface MedicalStaff {
  id: string;
  email: string;
  role: 'DOCTOR' | 'NURSE';
  staffCode: string;
  fullName: string;
  phone: string;
  primaryBranch: {
    id: string;
    branchCode: string;
    name: string;
  } | null;
  assignedBranches: Array<{
    id: string;
    branchCode: string;
    name: string;
  }>;
}

interface AssignMedicalStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
  branchName: string;
}

export default function AssignMedicalStaffModal({
  isOpen,
  onClose,
  onSuccess,
  branchId,
  branchName,
}: AssignMedicalStaffModalProps) {
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'DOCTOR' | 'NURSE'>('ALL');

  useEffect(() => {
    if (isOpen) {
      loadStaff();
    }
  }, [isOpen, branchId]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await branchesApi.getMedicalStaffNotInBranch(branchId);
      setStaff(response.data.data || []);
    } catch (error: any) {
      devError('Error loading medical staff:', error);
      showToast.error('Gagal memuat data staff medis');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (staffMember: MedicalStaff) => {
    try {
      setAssigning(staffMember.id);
      await branchesApi.assignUserToBranch(staffMember.id, branchId);
      showToast.success(`${staffMember.fullName} berhasil di-assign ke ${branchName}`);
      
      // Remove from list
      setStaff(prev => prev.filter(s => s.id !== staffMember.id));
      onSuccess();
    } catch (error: any) {
      devError('Error assigning staff:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal assign staff');
    } finally {
      setAssigning(null);
    }
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch = 
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.staffCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: string) => {
    return role === 'DOCTOR' ? <Stethoscope size={16} /> : <Heart size={16} />;
  };

  const getRoleLabel = (role: string) => {
    return role === 'DOCTOR' ? 'Dokter' : 'Perawat';
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 dark:bg-black/75 flex items-center justify-center z-[9999] p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b-2 border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <UserPlus size={24} className="text-amber-500" />
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Assign Dokter/Nakes</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-normal">
                Assign staff medis dari cabang lain ke <strong className="text-neutral-700 dark:text-neutral-200">{branchName}</strong>
              </p>
            </div>
          </div>
          <button 
            className="w-9 h-9 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search 
                size={18} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
              />
              <input
                type="text"
                placeholder="Cari nama, kode staff, atau email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2.5 pl-10 pr-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | 'DOCTOR' | 'NURSE')}
              className="px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
            >
              <option value="ALL">Semua Role</option>
              <option value="DOCTOR">Dokter</option>
              <option value="NURSE">Perawat</option>
            </select>
          </div>

          {/* Info Banner */}
          <div className="px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm text-neutral-600 dark:text-neutral-400">
            <strong className="text-blue-600 dark:text-blue-400">Info:</strong> Hanya menampilkan Dokter dan Perawat yang belum di-assign ke cabang ini.
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-4 overflow-y-auto min-h-[200px] max-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p>Memuat data staff medis...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400">
              <UserPlus size={48} className="mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
                {searchTerm || roleFilter !== 'ALL' ? 'Tidak Ada Hasil' : 'Semua Staff Sudah Di-assign'}
              </h3>
              <p className="text-center">
                {searchTerm || roleFilter !== 'ALL' 
                  ? 'Coba ubah filter atau kata kunci pencarian.'
                  : 'Semua Dokter dan Perawat sudah di-assign ke cabang ini.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredStaff.map((staffMember) => (
                <div
                  key={staffMember.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-amber-500/30 transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-semibold text-base ${
                      staffMember.role === 'DOCTOR' 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' 
                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                    }`}>
                      {staffMember.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {staffMember.fullName}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                          staffMember.role === 'DOCTOR'
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                        }`}>
                          {getRoleIcon(staffMember.role)}
                          {getRoleLabel(staffMember.role)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <span>{staffMember.staffCode}</span>
                        <span>•</span>
                        <span>{staffMember.email}</span>
                      </div>
                      {staffMember.assignedBranches.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Building2 size={12} className="text-neutral-400 dark:text-neutral-500" />
                          {staffMember.assignedBranches.slice(0, 3).map((branch) => (
                            <span
                              key={branch.id}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                            >
                              {branch.branchCode}
                            </span>
                          ))}
                          {staffMember.assignedBranches.length > 3 && (
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                              +{staffMember.assignedBranches.length - 3} lainnya
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssign(staffMember)}
                    disabled={assigning === staffMember.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {assigning === staffMember.id ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        Assign
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4 px-6 py-5 border-t-2 border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-sm font-semibold hover:border-neutral-300 dark:hover:border-neutral-600 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
