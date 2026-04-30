# Tampilan Insentif Referral di Invoice

## Tanggal: 30 April 2026

## Fitur Baru
Menampilkan informasi insentif referral di invoice, termasuk jumlah insentif dan nama penerima insentif.

## Implementasi

### 1. Backend - Update Invoice Retrieval Service

**File**: `apps/api/src/modules/invoices/services/invoice-retrieval.service.ts`

#### A. Include Referral Code di Query
Updated semua query invoice untuk include `referralCode`:

```typescript
include: {
  member: {
    include: {
      referralCode: true,
    },
  },
  // ... other includes
}
```

#### B. Ambil Data Insentif
Fungsi `formatInvoice()` sekarang async dan mengambil data insentif:

```typescript
async formatInvoice(invoice: any) {
  // Get incentive information for packages in this invoice
  let incentiveInfo = null;
  
  // Get package IDs from invoice items
  const packageIds = invoice.items
    .filter((item: any) => item.itemType === 'PACKAGE')
    .map((item: any) => item.itemId);
  
  if (packageIds.length > 0 && invoice.member.referralCode) {
    // Get incentive records for these packages
    const incentiveRecords = await prisma.referralIncentiveRecord.findMany({
      where: {
        memberPackageId: {
          in: packageIds,
        },
      },
      include: {
        referralCode: {
          select: {
            code: true,
            referrerName: true,
            referrerType: true,
          },
        },
      },
    });
    
    // If there are incentive records, sum them up
    if (incentiveRecords.length > 0) {
      const totalIncentive = incentiveRecords.reduce(
        (sum, record) => sum + Number(record.incentiveAmount),
        0
      );
      
      // Use the first record for referral info
      const firstRecord = incentiveRecords[0];
      
      incentiveInfo = {
        totalAmount: totalIncentive,
        referralCode: firstRecord.referralCode.code,
        referrerName: firstRecord.referralCode.referrerName,
        referrerType: firstRecord.referralCode.referrerType,
        recordCount: incentiveRecords.length,
      };
    }
  }
  
  return {
    // ... other fields
    incentive: incentiveInfo,
    // ... other fields
  };
}
```

#### C. Update Pemanggilan formatInvoice
Karena sekarang async, update pemanggilan di `getMemberInvoices()`:

```typescript
return Promise.all(invoices.map((inv: any) => this.formatInvoice(inv)));
```

### 2. Frontend - Update Type Definition

**File**: `apps/web/src/types/invoice.ts`

Tambahkan field `incentive` ke interface `Invoice`:

```typescript
export interface Invoice {
  // ... existing fields
  
  // Incentive information
  incentive?: {
    totalAmount: number;
    referralCode: string;
    referrerName: string;
    referrerType: 'MEMBER' | 'STAFF' | 'EXTERNAL';
    recordCount: number;
  };
  
  // ... other fields
}
```

### 3. Frontend - Update Invoice Document Component

**File**: `apps/web/src/components/invoices/InvoiceDocument.tsx`

Tambahkan section untuk menampilkan insentif setelah summary:

```tsx
{/* Incentive Information */}
{invoice.incentive && (
  <div className={styles.incentiveInfo}>
    <h3 className={styles.sectionTitle}>🎁 Informasi Insentif Referral</h3>
    <div className={styles.incentiveContent}>
      <p className={styles.incentiveRow}>
        <span className={styles.incentiveLabel}>Jumlah Insentif:</span>
        <span className={styles.incentiveValue}>{formatCurrency(invoice.incentive.totalAmount)}</span>
      </p>
      <p className={styles.incentiveRow}>
        <span className={styles.incentiveLabel}>Untuk:</span>
        <span className={styles.incentiveValue}>
          {invoice.incentive.referrerName} ({invoice.incentive.referralCode})
        </span>
      </p>
      <p className={styles.incentiveNote}>
        * Insentif referral akan diberikan kepada {invoice.incentive.referrerName}
      </p>
    </div>
  </div>
)}
```

### 4. Frontend - Update CSS Styling

**File**: `apps/web/src/components/invoices/InvoiceDocument.module.css`

Tambahkan styling untuk incentive info section:

```css
/* ============================================================
   INCENTIVE INFO
   ============================================================ */
.incentiveInfo {
  margin-top: 25px;
  padding: 15px;
  background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
  border-left: 4px solid #9c27b0;
  border-radius: 6px;
}

.incentiveContent {
  margin-top: 10px;
}

.incentiveRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0;
  font-size: 13px;
}

.incentiveLabel {
  font-weight: 600;
  color: #4a148c;
}

.incentiveValue {
  font-weight: 700;
  color: #6a1b9a;
  font-size: 14px;
}

.incentiveNote {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #ce93d8;
  font-size: 11px;
  color: #6a1b9a;
  font-style: italic;
}

/* Print support */
@media print {
  .incentiveInfo {
    background: #f3e5f5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

## Tampilan Invoice

### Struktur Invoice
```
┌─────────────────────────────────────────────┐
│ REVERSE AGING & HOMEOSTASIS CLUB            │
│ CV DUNIA SEHAT SENTOSA INDONESIA            │
│ Komplek Duta Merlin Blok E No 05-06         │
│ Jakarta Pusat | (021) 3192-8888             │
├─────────────────────────────────────────────┤
│ INVOICE                        [STATUS]      │
├─────────────────────────────────────────────┤
│ DETAIL INVOICE    │  TAGIHAN UNTUK          │
│ No: INV-XXX       │  Nama Member            │
│ Tanggal: ...      │  Member No: MBR-XXX     │
│ Jatuh Tempo: ...  │  Cabang: ...            │
├─────────────────────────────────────────────┤
│ ITEMS TABLE                                  │
│ No | Kode | Nama | Qty | Harga | Total      │
├─────────────────────────────────────────────┤
│ SUMMARY                                      │
│ Subtotal:              Rp 15.535.000        │
│ Diskon (10%):        - Rp  1.553.500        │
│ TOTAL PEMBAYARAN:      Rp 13.981.500        │
├─────────────────────────────────────────────┤
│ 🎁 INFORMASI INSENTIF REFERRAL              │ ← NEW!
│                                              │
│ Jumlah Insentif:       Rp  2.640.000        │
│ Untuk:                 Joko Widodo (REF-007)│
│                                              │
│ * Insentif referral akan diberikan kepada   │
│   Joko Widodo                                │
└─────────────────────────────────────────────┘
```

## Logika Perhitungan Insentif di Invoice

### Untuk Bundling
Jika invoice berisi bundling (1 BASIC + beberapa BOOSTER):
- Hanya ada **1 incentive record** untuk seluruh bundle
- `totalAmount` = insentif dari total bundling
- Contoh: Bundle Rp 13.200.000 × 20% = Rp 2.640.000

### Untuk Multiple Standalone Packages
Jika invoice berisi beberapa paket standalone:
- Ada **multiple incentive records** (1 per paket)
- `totalAmount` = sum dari semua incentive records
- `recordCount` menunjukkan jumlah records yang dijumlahkan

### Untuk Member Tanpa Referral
Jika member tidak punya referral code:
- `incentive` = `null`
- Section insentif tidak ditampilkan di invoice

## Contoh Response API

```json
{
  "id": "invoice-id",
  "invoiceNumber": "INV-PST-2604-0013",
  "memberName": "Tark",
  "memberNo": "MBR-PST-0021",
  "subtotal": 15535000,
  "discountAmount": 1553500,
  "totalAmount": 13981500,
  "incentive": {
    "totalAmount": 2640000,
    "referralCode": "REF-007",
    "referrerName": "Joko Widodo",
    "referrerType": "EXTERNAL",
    "recordCount": 1
  },
  "items": [...],
  "payments": [...]
}
```

## Testing

### Cara Test
1. Buka invoice untuk member yang punya referral code
2. Verifikasi section "🎁 Informasi Insentif Referral" muncul
3. Cek jumlah insentif sesuai dengan perhitungan:
   - Untuk bundling: 20% dari total bundling
   - Untuk first package: sesuai `firstIncentiveValue`
4. Cek nama penerima insentif dan kode referral ditampilkan
5. Test print/PDF - pastikan section insentif ikut tercetak

### Test Cases

#### Case 1: Bundle dengan Insentif PERCENTAGE
- Member: MBR-PST-0021
- Bundle: 1 BASIC (Rp 10.000.000) + 4 BOOSTER (Rp 3.200.000)
- Total: Rp 13.200.000
- Insentif: 20% × Rp 13.200.000 = **Rp 2.640.000**
- Penerima: Joko Widodo (REF-007)

#### Case 2: First Package dengan FIXED_AMOUNT
- Member: MBR-PST-0021 (first bundle)
- Bundle: 1 BASIC + 3 BOOSTER
- Total: Rp 13.946.500
- Insentif: **Rp 5.000.000** (FIXED_AMOUNT)
- Penerima: Joko Widodo (REF-007)

#### Case 3: Member Tanpa Referral
- Member tanpa referral code
- Section insentif **tidak ditampilkan**

## Files Modified
1. `apps/api/src/modules/invoices/services/invoice-retrieval.service.ts` - Ambil dan format data insentif
2. `apps/web/src/types/invoice.ts` - Tambah field incentive
3. `apps/web/src/components/invoices/InvoiceDocument.tsx` - Tampilkan section insentif
4. `apps/web/src/components/invoices/InvoiceDocument.module.css` - Styling section insentif

## Status
✅ **COMPLETED**
- Backend updated untuk include incentive data
- Frontend type definition updated
- Invoice document component updated
- CSS styling added dengan purple theme
- Print support included
- API server restarted successfully
