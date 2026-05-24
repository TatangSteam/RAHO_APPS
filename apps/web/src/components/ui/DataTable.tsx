'use client';

import { ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T, index: number) => string;
  stickyHeader?: boolean;
  compact?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════

function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700/50 rounded w-3/4"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════

function EmptyState({
  icon,
  title,
  description,
  action,
  colSpan,
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center">
          {icon && (
            <div className="mb-4 text-neutral-400 dark:text-neutral-500">
              {icon}
            </div>
          )}
          {title && (
            <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-4">
              {description}
            </p>
          )}
          {action}
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════
// SORT ICON
// ═══════════════════════════════════════════════════════════════

function SortIcon({ 
  active, 
  direction 
}: { 
  active: boolean; 
  direction?: 'asc' | 'desc' 
}) {
  if (!active) {
    return <ChevronsUpDown size={14} className="text-neutral-500" />;
  }
  return direction === 'asc' 
    ? <ChevronUp size={14} className="text-amber-500" />
    : <ChevronDown size={14} className="text-amber-500" />;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyIcon,
  emptyTitle = 'Tidak ada data',
  emptyDescription,
  emptyAction,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
  rowClassName,
  stickyHeader = false,
  compact = false,
  striped = true,
  hoverable = true,
  bordered = true,
  className = '',
}: DataTableProps<T>) {
  
  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3.5';
  const headerPadding = compact ? 'px-3 py-2.5' : 'px-4 py-3';

  return (
    <div className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 ${className}`}>
      <div 
        className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-neutral-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-800/50 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:hover:bg-neutral-400 dark:[&::-webkit-scrollbar-thumb]:hover:bg-neutral-500"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#525252 #262626',
        }}
      >
        <table className="w-full" style={{ tableLayout: 'auto' }}>
          {/* Header */}
          <thead className={`
            bg-neutral-50 dark:bg-neutral-800/80 
            ${stickyHeader ? 'sticky top-0 z-10' : ''}
          `}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    ${headerPadding}
                    ${getAlignClass(column.align)}
                    text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 whitespace-nowrap
                    ${bordered ? 'border-b border-neutral-200 dark:border-neutral-700/50' : ''}
                    ${column.sortable ? 'cursor-pointer select-none hover:bg-neutral-100 dark:hover:bg-neutral-700/30 transition-colors' : ''}
                    ${column.headerClassName || ''}
                  `}
                  style={{ width: column.width, minWidth: column.width }}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  <div className={`flex items-center gap-1.5 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                    <span>{column.header}</span>
                    {column.sortable && (
                      <SortIcon 
                        active={sortColumn === column.key} 
                        direction={sortColumn === column.key ? sortDirection : undefined}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {loading ? (
              <TableSkeleton columns={columns.length} />
            ) : data.length === 0 ? (
              <EmptyState
                icon={emptyIcon}
                title={emptyTitle}
                description={emptyDescription}
                action={emptyAction}
                colSpan={columns.length}
              />
            ) : (
              data.map((item, index) => (
                <tr
                  key={keyExtractor(item)}
                  className={`
                    ${striped && index % 2 === 1 ? 'bg-neutral-50 dark:bg-neutral-800/20' : 'bg-transparent'}
                    ${hoverable ? 'hover:bg-neutral-100 dark:hover:bg-neutral-800/40 transition-colors' : ''}
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${rowClassName?.(item, index) || ''}
                  `}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`
                        ${cellPadding}
                        ${getAlignClass(column.align)}
                        text-sm text-neutral-700 dark:text-neutral-300
                        ${bordered ? 'border-b border-neutral-100 dark:border-neutral-800/30' : ''}
                        ${column.key === 'actions' ? 'whitespace-nowrap' : ''}
                        ${column.cellClassName || ''}
                      `}
                      style={{ minWidth: column.width }}
                    >
                      {column.render 
                        ? column.render(item, index)
                        : (item as any)[column.key]
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPER COMPONENTS FOR COMMON CELL TYPES
// ═══════════════════════════════════════════════════════════════

export function AvatarCell({ 
  name, 
  subtitle,
  avatarUrl,
  badge,
  color = 'amber',
}: { 
  name: string; 
  subtitle?: string;
  avatarUrl?: string | null;
  badge?: ReactNode;
  color?: 'amber' | 'blue' | 'green' | 'purple' | 'red';
}) {
  const colorClasses = {
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-500',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-500',
    green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-500',
    purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-500',
    red: 'bg-red-500/15 text-red-600 dark:text-red-500',
  };

  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img 
          src={avatarUrl} 
          alt={name}
          className="w-9 h-9 rounded-lg object-cover"
        />
      ) : (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm ${colorClasses[color]}`}>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{name}</span>
          {badge}
        </div>
        {subtitle && (
          <span className="text-xs text-neutral-500 dark:text-neutral-500 truncate block">{subtitle}</span>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ 
  status, 
  variant = 'default',
}: { 
  status: string; 
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
}) {
  const variantClasses = {
    default: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300',
    success: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
    warning: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
    danger: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
    info: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
    purple: 'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/20',
  };

  return (
    <span className={`
      inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold
      ${variantClasses[variant]}
    `}>
      {status}
    </span>
  );
}

export function RoleBadge({ 
  role,
  icon,
}: { 
  role: string;
  icon?: ReactNode;
}) {
  const roleConfig: Record<string, { bg: string; text: string; label: string }> = {
    DOCTOR: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', label: 'Dokter' },
    NURSE: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', label: 'Perawat' },
    ADMIN_CABANG: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', label: 'Admin Cabang' },
    ADMIN_LAYANAN: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', label: 'Admin Layanan' },
    ADMIN_MANAGER: { bg: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-400', label: 'Admin Manager' },
    SUPER_ADMIN: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400', label: 'Super Admin' },
  };

  const config = roleConfig[role] || { bg: 'bg-neutral-200 dark:bg-neutral-700/50', text: 'text-neutral-600 dark:text-neutral-300', label: role };

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold
      ${config.bg} ${config.text}
    `}>
      {icon}
      {config.label}
    </span>
  );
}

export function ActionButtons({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {children}
    </div>
  );
}

export function ActionButton({ 
  onClick, 
  icon, 
  title,
  variant = 'default',
  disabled = false,
}: { 
  onClick: (e: React.MouseEvent) => void;
  icon: ReactNode;
  title: string;
  variant?: 'default' | 'edit' | 'delete' | 'view' | 'purple' | 'amber';
  disabled?: boolean;
}) {
  const variantClasses = {
    default: 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 hover:text-neutral-800 dark:bg-neutral-700/50 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200',
    edit: 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20',
    delete: 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20',
    view: 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
    purple: 'bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20',
    amber: 'bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20',
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      disabled={disabled}
      title={title}
      className={`
        p-2 rounded-lg transition-all duration-200
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {icon}
    </button>
  );
}
