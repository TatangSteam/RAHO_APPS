# Stock Mutation History - Implementation Guide

**Tanggal**: 7 Juni 2026  
**Status**: 📋 IMPLEMENTATION GUIDE  
**Features**: Stock Mutation History Page + Inventory Item History Tab

---

## 🎯 **OVERVIEW**

Menambahkan 2 fitur untuk tracking stock mutations:

1. **Stock Mutation History Page** - Dedicated page untuk lihat semua pergerakan stok
2. **Inventory Item History Tab** - Tab history di inventory item detail page

### **Use Case:**
User ingin tahu:
- Material INF001 dikurangi dari session mana saja?
- Berapa banyak material yang digunakan dalam periode tertentu?
- Siapa yang input material usage?
- Material mana yang paling banyak terpakai?

---

## 📊 **FEATURES SPECIFICATION**

### **Feature 1: Stock Mutation History Page**

**Location**: `/inventory/stock-mutations`

**Features:**
- List semua stock mutations across all items
- Filter by:
  - Inventory Item (INF001, INF002, dll)
  - Mutation Type (USED, RECEIVED, ADJUSTED, RETURNED)
  - Date Range
  - Branch (for multi-branch access)
- Search by item name/SKU
- Sorting by date (newest/oldest)
- Pagination (50 items per page)
- Export to Excel
- Click row → navigate to related session/shipment

**Columns:**
| Column | Description |
|--------|-------------|
| Tanggal | Waktu mutation |
| Item | Nama item + SKU |
| Type | USED / RECEIVED / ADJUSTED / RETURNED |
| Quantity | Jumlah perubahan |
| Before | Stok sebelum |
| After | Stok setelah |
| Reference | Link ke session/shipment |
| User | Yang input |
| Notes | Catatan |

---

### **Feature 2: Inventory Item History Tab**

**Location**: `/inventory` → Click item → Tab "History"

**Features:**
- Show mutations untuk item yang dipilih saja
- Timeline view (newest first)
- Same columns as Feature 1
- No filter (already filtered by item)
- Export to Excel for this item only
- Click row → navigate to related session/shipment

**Layout:**
```
[Tab: Overview] [Tab: History*] [Tab: Stock Opname]

📊 History Mutations - INF001 (Infus Set)
Showing 25 mutations

[Export Excel]

Timeline:
┌─────────────────────────────────────────────┐
│ 7 Jun 2026, 10:30 - USED                   │
│ -52 pcs (147 → 95)                          │
│ Session: SES-2026-001 (Member: John Doe)   │
│ By: Nurse Sarah                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 5 Jun 2026, 14:00 - RECEIVED               │
│ +100 pcs (47 → 147)                         │
│ Shipment: SHP-2026-042                     │
│ By: Admin Pusat                             │
└─────────────────────────────────────────────┘
```

---

## 🗂️ **IMPLEMENTATION STEPS**

### **STEP 1: Backend - Stock Mutation API**

#### File: `apps/api/src/modules/inventory/inventory.service.ts`

**Add method to get stock mutations:**

```typescript
async getStockMutations(filters: {
  inventoryItemId?: string;
  type?: StockMutationType;
  startDate?: string;
  endDate?: string;
  branchId?: string;
  page?: number;
  limit?: number;
}) {
  const { 
    inventoryItemId, 
    type, 
    startDate, 
    endDate, 
    branchId,
    page = 1, 
    limit = 50 
  } = filters;

  const where: any = {};

  // Filter by item
  if (inventoryItemId) {
    where.inventoryItemId = inventoryItemId;
  }

  // Filter by type
  if (type) {
    where.type = type;
  }

  // Filter by date range
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  // Filter by branch (via inventoryItem)
  if (branchId) {
    where.inventoryItem = { branchId };
  }

  // Get total count
  const total = await prisma.stockMutation.count({ where });

  // Get mutations with relations
  const mutations = await prisma.stockMutation.findMany({
    where,
    include: {
      inventoryItem: {
        include: {
          masterProduct: true,
          branch: true,
        },
      },
      // Get user who created
      ...(await prisma.user.findUnique({
        where: { id: mutations[0]?.createdBy },
        select: { profile: { select: { fullName: true } } },
      })),
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Format response with reference info
  const formattedMutations = await Promise.all(
    mutations.map(async (mutation) => {
      let referenceInfo = null;

      // Get reference details based on referenceType
      if (mutation.referenceType === 'MaterialUsage' && mutation.referenceId) {
        const materialUsage = await prisma.materialUsage.findUnique({
          where: { id: mutation.referenceId },
          include: {
            treatmentSession: {
              include: {
                member: { include: { profile: true } },
              },
            },
          },
        });

        if (materialUsage) {
          referenceInfo = {
            type: 'session',
            id: materialUsage.treatmentSessionId,
            sessionCode: materialUsage.treatmentSession.sessionCode,
            memberName: materialUsage.treatmentSession.member.profile.fullName,
            treatmentDate: materialUsage.treatmentSession.treatmentDate,
          };
        }
      } else if (mutation.referenceType === 'Shipment' && mutation.referenceId) {
        const shipment = await prisma.shipment.findUnique({
          where: { id: mutation.referenceId },
          select: {
            shipmentCode: true,
            branchFrom: { select: { name: true } },
            branchTo: { select: { name: true } },
          },
        });

        if (shipment) {
          referenceInfo = {
            type: 'shipment',
            id: mutation.referenceId,
            shipmentCode: shipment.shipmentCode,
            from: shipment.branchFrom.name,
            to: shipment.branchTo.name,
          };
        }
      }

      // Get user name
      const user = await prisma.user.findUnique({
        where: { id: mutation.createdBy },
        select: { profile: { select: { fullName: true } } },
      });

      return {
        ...mutation,
        referenceInfo,
        createdByName: user?.profile?.fullName || 'Unknown',
      };
    })
  );

  return {
    data: formattedMutations,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Export to Excel
async exportStockMutations(filters: any) {
  const { data } = await this.getStockMutations({ ...filters, limit: 10000 });

  // Use ExcelJS to create workbook
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stock Mutations');

  // Add headers
  worksheet.columns = [
    { header: 'Tanggal', key: 'createdAt', width: 20 },
    { header: 'Item', key: 'itemName', width: 30 },
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Stock Before', key: 'stockBefore', width: 12 },
    { header: 'Stock After', key: 'stockAfter', width: 12 },
    { header: 'Reference', key: 'reference', width: 25 },
    { header: 'User', key: 'user', width: 20 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];

  // Add data
  data.forEach((mutation) => {
    worksheet.addRow({
      createdAt: new Date(mutation.createdAt).toLocaleString('id-ID'),
      itemName: mutation.inventoryItem.masterProduct.name,
      sku: mutation.inventoryItem.masterProduct.sku,
      type: mutation.type,
      quantity: Number(mutation.quantity),
      stockBefore: Number(mutation.stockBefore),
      stockAfter: Number(mutation.stockAfter),
      reference: mutation.referenceInfo
        ? mutation.referenceInfo.type === 'session'
          ? `Session: ${mutation.referenceInfo.sessionCode}`
          : `Shipment: ${mutation.referenceInfo.shipmentCode}`
        : '-',
      user: mutation.createdByName,
      notes: mutation.notes || '-',
    });
  });

  // Style header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD4A853' },
  };

  return workbook;
}
```

---

#### File: `apps/api/src/modules/inventory/inventory.controller.ts`

**Add controller methods:**

```typescript
export async function getStockMutations(req: Request, res: Response, next: NextFunction) {
  try {
    const { 
      inventoryItemId, 
      type, 
      startDate, 
      endDate,
      branchId,
      page, 
      limit 
    } = req.query;

    const result = await inventoryService.getStockMutations({
      inventoryItemId: inventoryItemId as string,
      type: type as StockMutationType,
      startDate: startDate as string,
      endDate: endDate as string,
      branchId: branchId as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function exportStockMutations(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = req.query;
    const workbook = await inventoryService.exportStockMutations(filters);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=stock-mutations-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}
```

---

#### File: `apps/api/src/modules/inventory/inventory.routes.ts`

**Add routes:**

```typescript
// Get stock mutations with filters
router.get('/stock-mutations', authenticate, getStockMutations);

// Export stock mutations to Excel
router.get('/stock-mutations/export', authenticate, exportStockMutations);
```

---

### **STEP 2: Frontend - Stock Mutation History Page**

#### File: `apps/web/src/app/(staff)/inventory/stock-mutations/page.tsx` (NEW)

Ini adalah file besar (400+ lines), saya akan berikan struktur utama:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { inventoryApi } from '@/lib/api/inventoryApi';

export default function StockMutationsPage() {
  const [mutations, setMutations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    inventoryItemId: '',
    type: '',
    startDate: '',
    endDate: '',
    page: 1,
  });
  const [pagination, setPagination] = useState(null);

  // Load mutations
  useEffect(() => {
    loadMutations();
  }, [filters]);

  const loadMutations = async () => {
    setLoading(true);
    try {
      const result = await inventoryApi.getStockMutations(filters);
      setMutations(result.data);
      setPagination(result.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    window.open(`/api/inventory/stock-mutations/export?${new URLSearchParams(filters)}`);
  };

  return (
    <div className="page-container">
      <h1>📊 Stock Mutation History</h1>
      
      {/* Filters */}
      <div className="filters">
        <select onChange={(e) => setFilters({...filters, type: e.target.value})}>
          <option value="">All Types</option>
          <option value="USED">Used</option>
          <option value="RECEIVED">Received</option>
          <option value="ADJUSTED">Adjusted</option>
        </select>
        {/* More filters... */}
        <button onClick={handleExport}>Export Excel</button>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Item</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Before → After</th>
            <th>Reference</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          {mutations.map((mutation) => (
            <tr key={mutation.id}>
              <td>{new Date(mutation.createdAt).toLocaleString()}</td>
              <td>{mutation.inventoryItem.masterProduct.name}</td>
              <td>
                <span className={`badge badge-${mutation.type.toLowerCase()}`}>
                  {mutation.type}
                </span>
              </td>
              <td className={mutation.type === 'USED' ? 'text-red' : 'text-green'}>
                {mutation.type === 'USED' ? '-' : '+'}{mutation.quantity}
              </td>
              <td>{mutation.stockBefore} → {mutation.stockAfter}</td>
              <td>
                {mutation.referenceInfo && (
                  <a href={`/sessions/${mutation.referenceInfo.id}`}>
                    {mutation.referenceInfo.sessionCode}
                  </a>
                )}
              </td>
              <td>{mutation.createdByName}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        {/* Pagination controls */}
      </div>
    </div>
  );
}
```

---

### **STEP 3: Frontend - Add History Tab to Inventory Item**

#### Update: `apps/web/src/app/(staff)/inventory/page.tsx`

Tambahkan link ke item detail page:

```typescript
<td>
  <Link href={`/inventory/items/${item.id}`}>
    {item.masterProduct.name}
  </Link>
</td>
```

---

#### File: `apps/web/src/app/(staff)/inventory/items/[itemId]/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function InventoryItemDetailPage() {
  const params = useParams();
  const itemId = params.itemId as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [item, setItem] = useState(null);
  const [mutations, setMutations] = useState([]);

  useEffect(() => {
    loadItem();
    if (activeTab === 'history') {
      loadMutations();
    }
  }, [itemId, activeTab]);

  const loadItem = async () => {
    const result = await inventoryApi.getItem(itemId);
    setItem(result);
  };

  const loadMutations = async () => {
    const result = await inventoryApi.getStockMutations({ inventoryItemId: itemId });
    setMutations(result.data);
  };

  return (
    <div className="page-container">
      <h1>{item?.masterProduct.name}</h1>
      <p>SKU: {item?.masterProduct.sku}</p>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          <p>Stock: {item?.stock}</p>
          <p>Min Stock: {item?.minStock}</p>
          {/* More overview info */}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h2>📜 Mutation History</h2>
          {/* Timeline view of mutations */}
          {mutations.map((mutation) => (
            <div key={mutation.id} className="timeline-item">
              <div className="timeline-date">
                {new Date(mutation.createdAt).toLocaleString()}
              </div>
              <div className="timeline-content">
                <span className={`badge badge-${mutation.type.toLowerCase()}`}>
                  {mutation.type}
                </span>
                <p>{mutation.quantity} pcs ({mutation.stockBefore} → {mutation.stockAfter})</p>
                {mutation.referenceInfo && (
                  <a href={`/sessions/${mutation.referenceInfo.id}`}>
                    Session: {mutation.referenceInfo.sessionCode}
                  </a>
                )}
                <p className="text-muted">By: {mutation.createdByName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### **STEP 4: Frontend API Client**

#### Update: `apps/web/src/lib/api/inventoryApi.ts`

```typescript
export const inventoryApi = {
  // ... existing methods ...

  async getStockMutations(filters: any) {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });
    
    const response = await api.get(`/inventory/stock-mutations?${params}`);
    return response.data.data;
  },

  async getItem(itemId: string) {
    const response = await api.get(`/inventory/items/${itemId}`);
    return response.data.data;
  },
};
```

---

### **STEP 5: Add Menu Item to Sidebar**

#### Update: `apps/web/src/components/layout/Sidebar.tsx`

```typescript
{
  title: 'Inventory',
  items: [
    { label: 'Stock Overview', href: '/inventory', icon: Package },
    { label: 'Stock Mutations', href: '/inventory/stock-mutations', icon: History }, // NEW
    { label: 'Stock Requests', href: '/inventory/stock-requests', icon: FileText },
    { label: 'Shipments', href: '/inventory/shipments', icon: Truck },
  ],
}
```

---

## 🧪 **TESTING GUIDE**

### **Test 1: Stock Mutation History Page**
```
1. Navigate to /inventory/stock-mutations
2. Should see list of all stock mutations
3. Filter by item INF001
4. Should see only mutations for INF001
5. Filter by type USED
6. Should see only USED mutations
7. Click Export Excel
8. Should download Excel file with filtered data
9. Click session reference link
10. Should navigate to session detail page
```

### **Test 2: Item History Tab**
```
1. Navigate to /inventory
2. Click item INF001
3. Should see item detail page
4. Click "History" tab
5. Should see timeline of mutations for INF001
6. Verify shows:
   - Date & time
   - Type (USED/RECEIVED)
   - Quantity change
   - Stock before → after
   - Reference to session
   - User who input
7. Click session link
8. Should navigate to session detail
```

---

## 📊 **UI/UX MOCKUPS**

### **Stock Mutation History Page:**
```
┌─────────────────────────────────────────────────────────┐
│ 📊 Stock Mutation History                               │
│                                                         │
│ [Filter: Item ▼] [Type ▼] [Start Date] [End Date]     │
│ [🔍 Search] [Export Excel]                             │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Date     │ Item      │ Type │ Qty │ Before→After  ││
│ ├─────────────────────────────────────────────────────┤│
│ │ 7Jun10:30│ INF001    │USED  │ -52 │ 147 → 95      ││
│ │          │ Infus Set │      │     │ SES-001       ││
│ ├─────────────────────────────────────────────────────┤│
│ │ 5Jun14:00│ INF001    │RCVD  │+100 │ 47 → 147      ││
│ │          │ Infus Set │      │     │ SHP-042       ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ [← Prev] Page 1 of 5 [Next →]                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 **ESTIMATED EFFORT**

| Task | Time | Complexity |
|------|------|------------|
| Backend API | 3 hours | Medium |
| Frontend History Page | 4 hours | Medium |
| Frontend Item Detail + Tab | 3 hours | Medium |
| Testing | 2 hours | Low |
| **TOTAL** | **12 hours** | **Medium** |

---

## 🚀 **DEPLOYMENT CHECKLIST**

- [ ] Backend: Add stock mutation endpoints
- [ ] Frontend: Create stock mutations page
- [ ] Frontend: Add item detail page with history tab
- [ ] Update sidebar menu
- [ ] Test all filters
- [ ] Test Excel export
- [ ] Test reference links
- [ ] Update user documentation

---

**Guide dibuat oleh**: Kiro AI  
**Status**: Ready for implementation  
**Priority**: HIGH (User requested)

