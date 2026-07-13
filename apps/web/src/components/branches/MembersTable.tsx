'use client';

import { Users, Edit, Trash2, Plus, Key, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

interface Member {
  memberId: string;
  memberNo: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  isActive: boolean;
  registrationBranch: string;
  voucherCount: number;
  basicPackageCount: number;
  isLintas: boolean;
  hasInformedConsent?: boolean;
  photoUrl?: string;
}

interface MembersTableProps {
  data: Member[];
  loading?: boolean;
  currentBranchCode?: string;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onAddMember: () => void;
  showDeleteButton?: boolean;
  showCredentialsButton?: boolean;
  onManageCredentials?: (member: Member) => void;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function MembersTable({
  data,
  loading = false,
  currentBranchCode,
  onEdit,
  onDelete,
  onAddMember,
  showDeleteButton = false,
  showCredentialsButton = false,
  onManageCredentials,
}: MembersTableProps) {
  
  const router = useRouter();

  const getMissingWarnings = (member: Member) => [
    !member.phone?.trim() ? 'No HP kosong' : null,
    !member.hasInformedConsent ? 'Consent kosong' : null,
  ].filter(Boolean) as string[];
  
  const columns: Column<Member>[] = [
    {
      key: 'memberNo',
      header: 'Member',
      width: '220px',
      render: (member) => {
        const missingWarnings = getMissingWarnings(member);

        return (
          <AvatarCell
            name={member.fullName}
            subtitle={member.memberNo}
            avatarUrl={member.photoUrl}
            color="amber"
            badge={(member.isLintas || missingWarnings.length > 0) ? (
              <div className="flex flex-wrap items-center gap-1">
                {member.isLintas && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 rounded">
                    LINTAS
                  </span>
                )}
                {missingWarnings.map((warning) => (
                  <span
                    key={warning}
                    title={warning}
                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
                  >
                    {warning}
                  </span>
                ))}
              </div>
            ) : undefined}
          />
        );
      },
    },
    {
      key: 'email',
      header: 'Username',
      width: '180px',
      render: (member) => (
        <span className="text-neutral-600 dark:text-neutral-400 text-sm truncate block max-w-[160px]">{member.email}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      width: '130px',
      render: (member) => (
        <span className="text-neutral-600 dark:text-neutral-400">{member.phone || '-'}</span>
      ),
    },
    {
      key: 'registrationBranch',
      header: 'Cabang',
      width: '100px',
      align: 'center',
      render: (member) => {
        const isCurrentBranch = member.registrationBranch === currentBranchCode;
        return (
          <span className={`
            inline-flex px-2 py-1 rounded-md text-xs font-semibold
            ${isCurrentBranch 
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20' 
              : 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20'
            }
          `}>
            {member.registrationBranch}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Tgl Daftar',
      width: '110px',
      render: (member) => (
        <span className="text-neutral-600 dark:text-neutral-400 text-sm">
          {new Date(member.createdAt).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      width: '90px',
      align: 'center',
      render: (member) => (
        <StatusBadge 
          status={member.isActive ? 'Aktif' : 'Tidak Aktif'} 
          variant={member.isActive ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: '180px',
      align: 'right',
      render: (member) => (
        <ActionButtons>
          <ActionButton
            onClick={() => router.push(`/members/${member.memberId}`)}
            icon={<Eye size={14} />}
            title="Lihat Detail Member"
            variant="view"
          />
          {showCredentialsButton && onManageCredentials && (
            <ActionButton
              onClick={() => onManageCredentials(member)}
              icon={<Key size={14} />}
              title="Kelola Kredensial"
              variant="amber"
            />
          )}
          <ActionButton
            onClick={() => onEdit(member)}
            icon={<Edit size={14} />}
            title="Edit Member"
            variant="edit"
          />
          {showDeleteButton && (
            <ActionButton
              onClick={() => onDelete(member)}
              icon={<Trash2 size={14} />}
              title="Hapus Member"
              variant="delete"
            />
          )}
        </ActionButtons>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(member) => member.memberId}
      loading={loading}
      emptyIcon={<Users size={48} className="opacity-50" />}
      emptyTitle="Belum Ada Member"
      emptyDescription="Cabang ini belum memiliki member terdaftar."
      emptyAction={
        <button
          onClick={onAddMember}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors"
        >
          <Plus size={18} />
          Tambah Member Pertama
        </button>
      }
      striped
      hoverable
    />
  );
}
