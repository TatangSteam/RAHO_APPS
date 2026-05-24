'use client';

import { Stethoscope, Heart, Building2, Edit, Trash2, UserCog, Plus, Activity, Key } from 'lucide-react';
import DataTable, { 
  Column, 
  AvatarCell, 
  StatusBadge, 
  RoleBadge, 
  ActionButtons, 
  ActionButton 
} from '@/components/ui/DataTable';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Staff {
  id: string;
  email: string;
  role: string;
  staffCode: string;
  isActive: boolean;
  therapyCount?: number;
  therapyCountAsDoctor?: number;
  therapyCountAsNurse?: number;
  therapyCountAsAdminLayanan?: number;
  profile: {
    fullName: string;
    phone: string;
  };
  branch?: {
    name: string;
    branchCode: string;
  };
}

interface StaffTableProps {
  data: Staff[];
  loading?: boolean;
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
  onManageBranches: (staff: Staff) => void;
  onManageCredentials?: (staff: Staff) => void;
  onAddStaff: () => void;
  showCredentialsButton?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'DOCTOR': return <Stethoscope size={12} />;
    case 'NURSE': return <Heart size={12} />;
    default: return null;
  }
};

const getRoleColor = (role: string): 'blue' | 'green' | 'amber' | 'purple' => {
  switch (role) {
    case 'DOCTOR': return 'blue';
    case 'NURSE': return 'green';
    case 'ADMIN_CABANG': return 'amber';
    default: return 'purple';
  }
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function StaffTable({
  data,
  loading = false,
  onEdit,
  onDelete,
  onManageBranches,
  onManageCredentials,
  onAddStaff,
  showCredentialsButton = false,
}: StaffTableProps) {
  
  const columns: Column<Staff>[] = [
    {
      key: 'staffCode',
      header: 'Staff',
      width: '200px',
      render: (staff) => (
        <AvatarCell
          name={staff.profile?.fullName || 'Unknown'}
          subtitle={staff.staffCode}
          color={getRoleColor(staff.role)}
        />
      ),
    },
    {
      key: 'email',
      header: 'Email',
      width: '180px',
      render: (staff) => (
        <span className="text-neutral-600 dark:text-neutral-400 text-sm truncate block max-w-[160px]">{staff.email}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      width: '120px',
      render: (staff) => (
        <span className="text-neutral-600 dark:text-neutral-400 text-sm">{staff.profile?.phone || '-'}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '130px',
      render: (staff) => (
        <RoleBadge role={staff.role} icon={getRoleIcon(staff.role)} />
      ),
    },
    {
      key: 'therapyCount',
      header: 'Kinerja Terapi',
      width: '200px',
      render: (staff) => {
        const asDoctor = staff.therapyCountAsDoctor || 0;
        const asNurse = staff.therapyCountAsNurse || 0;
        const asAdmin = staff.therapyCountAsAdminLayanan || 0;
        const total = staff.therapyCount || 0;
        
        // For ADMIN_CABANG, show all three counts
        if (staff.role === 'ADMIN_CABANG') {
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-amber-500" />
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">{total} total</span>
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                {asDoctor > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                    Dokter: {asDoctor}
                  </span>
                )}
                {asNurse > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
                    Nakes: {asNurse}
                  </span>
                )}
                {asAdmin > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    Admin: {asAdmin}
                  </span>
                )}
                {total === 0 && (
                  <span className="text-neutral-400 dark:text-neutral-500">Belum ada</span>
                )}
              </div>
            </div>
          );
        }
        
        // For DOCTOR, show doctor count
        if (staff.role === 'DOCTOR') {
          return (
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-blue-500" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {asDoctor} sesi
              </span>
            </div>
          );
        }
        
        // For NURSE, show nurse count
        if (staff.role === 'NURSE') {
          return (
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-green-500" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {asNurse} sesi
              </span>
            </div>
          );
        }
        
        // For ADMIN_LAYANAN, show admin count
        if (staff.role === 'ADMIN_LAYANAN') {
          return (
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-purple-500" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {asAdmin} sesi
              </span>
            </div>
          );
        }
        
        // Default
        return (
          <span className="text-sm text-neutral-400 dark:text-neutral-500">-</span>
        );
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      width: '100px',
      align: 'center',
      render: (staff) => (
        <StatusBadge 
          status={staff.isActive ? 'Aktif' : 'Tidak Aktif'} 
          variant={staff.isActive ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: '180px',
      align: 'right',
      render: (staff) => (
        <ActionButtons>
          {showCredentialsButton && onManageCredentials && (
            <ActionButton
              onClick={() => onManageCredentials(staff)}
              icon={<Key size={14} />}
              title="Kelola Kredensial"
              variant="amber"
            />
          )}
          {(staff.role === 'DOCTOR' || staff.role === 'NURSE') && (
            <ActionButton
              onClick={() => onManageBranches(staff)}
              icon={<Building2 size={14} />}
              title="Kelola Cabang"
              variant="purple"
            />
          )}
          <ActionButton
            onClick={() => onEdit(staff)}
            icon={<Edit size={14} />}
            title="Edit Staff"
            variant="edit"
          />
          <ActionButton
            onClick={() => onDelete(staff)}
            icon={<Trash2 size={14} />}
            title="Hapus Staff"
            variant="delete"
          />
        </ActionButtons>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(staff) => staff.id}
      loading={loading}
      emptyIcon={<UserCog size={48} className="opacity-50" />}
      emptyTitle="Belum Ada Staff"
      emptyDescription="Cabang ini belum memiliki staff terdaftar."
      emptyAction={
        <button
          onClick={onAddStaff}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors"
        >
          <Plus size={18} />
          Tambah Staff Pertama
        </button>
      }
      striped
      hoverable
    />
  );
}
