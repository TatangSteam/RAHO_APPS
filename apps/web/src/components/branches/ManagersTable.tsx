'use client';

import { Shield, Trash2, Plus } from 'lucide-react';
import DataTable, { 
  Column, 
  AvatarCell, 
  StatusBadge, 
  ActionButtons, 
  ActionButton 
} from '@/components/ui/DataTable';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Manager {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  assignedAt: string;
}

interface ManagersTableProps {
  data: Manager[];
  loading?: boolean;
  canManage?: boolean;
  onUnassign: (manager: Manager) => void;
  onAssignManager: () => void;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ManagersTable({
  data,
  loading = false,
  canManage = false,
  onUnassign,
  onAssignManager,
}: ManagersTableProps) {
  
  const columns: Column<Manager>[] = [
    {
      key: 'fullName',
      header: 'Nama',
      width: '220px',
      render: (manager) => (
        <AvatarCell
          name={manager.fullName || 'Unknown'}
          subtitle="ADMIN_MANAGER"
          avatarUrl={manager.avatarUrl}
          color="purple"
        />
      ),
    },
    {
      key: 'email',
      header: 'Email',
      width: '180px',
      render: (manager) => (
        <span className="text-neutral-600 dark:text-neutral-400 truncate block max-w-[160px]">{manager.email}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      width: '130px',
      render: (manager) => (
        <span className="text-neutral-600 dark:text-neutral-400">{manager.phone || '-'}</span>
      ),
    },
    {
      key: 'assignedAt',
      header: 'Tgl Assign',
      width: '110px',
      render: (manager) => (
        <span className="text-neutral-600 dark:text-neutral-400 text-sm">
          {new Date(manager.assignedAt).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Login Terakhir',
      width: '130px',
      render: (manager) => (
        <span className="text-neutral-600 dark:text-neutral-400 text-sm">
          {manager.lastLoginAt 
            ? new Date(manager.lastLoginAt).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '-'
          }
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      width: '90px',
      align: 'center',
      render: (manager) => (
        <StatusBadge 
          status={manager.isActive ? 'Aktif' : 'Tidak Aktif'} 
          variant={manager.isActive ? 'success' : 'danger'}
        />
      ),
    },
    ...(canManage ? [{
      key: 'actions',
      header: 'Aksi',
      width: '80px',
      align: 'right' as const,
      render: (manager: Manager) => (
        <ActionButtons>
          <ActionButton
            onClick={() => onUnassign(manager)}
            icon={<Trash2 size={14} />}
            title="Hapus dari Cabang"
            variant="delete"
          />
        </ActionButtons>
      ),
    }] : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(manager) => manager.id}
      loading={loading}
      emptyIcon={<Shield size={48} className="opacity-50" />}
      emptyTitle="Belum Ada Admin Manager"
      emptyDescription="Cabang ini belum memiliki Admin Manager yang di-assign."
      emptyAction={canManage ? (
        <button
          onClick={onAssignManager}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus size={18} />
          Assign Manager Pertama
        </button>
      ) : undefined}
      striped
      hoverable
    />
  );
}
