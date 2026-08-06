'use client';

import { Package, Edit, Trash2, Plus, AlertTriangle } from 'lucide-react';
import DataTable, { 
  Column, 
  ActionButtons, 
  ActionButton 
} from '@/components/ui/DataTable';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  stock: number;
  usageStock: number;
  stockDisplay: string;
  minThreshold: number;
  minThresholdUsage: number;
  thresholdDisplay: string;
  isLowStock: boolean;
  storageLocation?: string;
  masterProductId?: string;
}

interface InventoryTableProps {
  data: InventoryItem[];
  loading?: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onAddItem: () => void;
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY BADGE
// ═══════════════════════════════════════════════════════════════

function CategoryBadge({ category }: { category: string }) {
  const categoryConfig: Record<string, { bg: string; text: string }> = {
    'INFUSION': { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
    'MATERIAL': { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
    'CONSUMABLE': { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
    'EQUIPMENT': { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' },
  };

  const config = categoryConfig[category] || { bg: 'bg-neutral-200 dark:bg-neutral-700/50', text: 'text-neutral-600 dark:text-neutral-300' };

  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${config.bg} ${config.text}`}>
      {category}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// STOCK DISPLAY
// ═══════════════════════════════════════════════════════════════

function StockDisplay({ 
  stockDisplay, 
  isLowStock 
}: { 
  stockDisplay: string; 
  isLowStock: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-semibold ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
        {stockDisplay}
      </span>
      {isLowStock && (
        <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function InventoryTable({
  data,
  loading = false,
  onEdit,
  onDelete,
  onAddItem,
}: InventoryTableProps) {
  
  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Nama Item',
      width: '220px',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-500 flex items-center justify-center flex-shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate block">{item.name}</span>
            {item.isLowStock && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 rounded font-semibold">
                  STOK RENDAH
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      width: '120px',
      render: (item) => <CategoryBadge category={item.category} />,
    },
    {
      key: 'stockDisplay',
      header: 'Stok',
      width: '130px',
      render: (item) => (
        <StockDisplay stockDisplay={item.stockDisplay} isLowStock={item.isLowStock} />
      ),
    },
    {
      key: 'thresholdDisplay',
      header: 'Min. Stok',
      width: '110px',
      render: (item) => (
        <span className="text-neutral-600 dark:text-neutral-400">{item.thresholdDisplay}</span>
      ),
    },
    {
      key: 'storageLocation',
      header: 'Lokasi',
      width: '110px',
      render: (item) => (
        <span className="text-neutral-600 dark:text-neutral-400">{item.storageLocation || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: '100px',
      align: 'right',
      render: (item) => (
        <ActionButtons>
          <ActionButton
            onClick={() => onEdit(item)}
            icon={<Edit size={14} />}
            title="Edit Item"
            variant="edit"
          />
          <ActionButton
            onClick={() => onDelete(item)}
            icon={<Trash2 size={14} />}
            title="Hapus Item"
            variant="delete"
          />
        </ActionButtons>
      ),
    },
  ];

  // Sort data to show low stock items first
  const sortedData = [...data].sort((a, b) => {
    if (a.isLowStock && !b.isLowStock) return -1;
    if (!a.isLowStock && b.isLowStock) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <DataTable
      columns={columns}
      data={sortedData}
      keyExtractor={(item) => item.id}
      loading={loading}
      emptyIcon={<Package size={48} className="opacity-50" />}
      emptyTitle="Belum Ada Stok"
      emptyDescription="Cabang ini belum memiliki data inventori."
      emptyAction={
        <button
          onClick={onAddItem}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors"
        >
          <Plus size={18} />
          Tambah Item Pertama
        </button>
      }
      striped
      hoverable
      rowClassName={(item) => item.isLowStock ? 'bg-red-500/5' : ''}
    />
  );
}
