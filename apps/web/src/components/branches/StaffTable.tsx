'use client';

import { Stethoscope, Heart, Building2, Edit, Trash2, UserCog, Plus } from 'lucide-react';
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
  onAddStaff: () => void;
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
  onAddStaff,
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
      width: '200px',
      render: (staff) => (
        <span className="text-neutral-600 dark:text-neutral-400 text-sm truncate block max-w-[180px]">{staff.email}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      width: '130px',
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
      width: '140px',
      align: 'right',
      render: (staff) => (
        <ActionButtons>
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
