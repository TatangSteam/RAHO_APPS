# 📦 Package Management Features - Implementation Guide

## 🎯 Requirements

### 1. Refund Paket (Setelah Dibayar)
- **Role**: ADMIN_LAYANAN, ADMIN_CABANG
- **Status**: ACTIVE → CANCELLED
- **Action**: Refund pembayaran yang sudah dilakukan
- **Audit**: Log refund dengan alasan

### 2. Pembatalan Pembelian (Belum Dibayar)
- **Role**: ADMIN_LAYANAN, ADMIN_CABANG
- **Status**: PENDING_PAYMENT → CANCELLED
- **Action**: Cancel invoice dan paket
- **Audit**: Log pembatalan

### 3. Edit Pembelian Paket (Sebelum Dibayar)
- **Role**: ADMIN_LAYANAN, ADMIN_CABANG
- **Status**: PENDING_PAYMENT only
- **Action**: Edit quantity, discount, notes
- **Audit**: Log perubahan

### 4. Detail Insentif Member
- **Display**: Jumlah rupiah DAN persentase
- **Location**: Member detail page
- **Format**: "Rp 50.000 (5%)" atau "5% (Rp 50.000)"

---

## 🔧 Implementation Plan

### Phase 1: Backend API

#### 1.1 Refund Package Endpoint
```
POST /api/v1/packages/:packageId/refund
Body: {
  reason: string,
  refundAmount: number (optional, default = finalPrice)
}
Response: {
  success: true,
  data: {
    package: MemberPackage,
    refundAmount: number
  }
}
```

#### 1.2 Cancel Package Endpoint
```
POST /api/v1/packages/:packageId/cancel
Body: {
  reason: string
}
Response: {
  success: true,
  data: {
    package: MemberPackage,
    invoice: Invoice (if exists)
  }
}
```

#### 1.3 Edit Package Endpoint
```
PUT /api/v1/packages/:packageId
Body: {
  quantity?: number,
  discount?: number,
  discountNote?: string,
  notes?: string
}
Response: {
  success: true,
  data: MemberPackage
}
```

#### 1.4 Member Incentive Detail
```
GET /api/v1/members/:memberId
Response includes:
{
  ...member data,
  referralCode: {
    ...code data,
    firstIncentiveValue: number,
    firstIncentiveType: 'PERCENTAGE' | 'FIXED',
    nextIncentiveValue: number,
    nextIncentiveType: 'PERCENTAGE' | 'FIXED'
  }
}
```

---

### Phase 2: Database Schema Updates

#### 2.1 Add Refund Tracking (Optional - if needed)
```prisma
model PackageRefund {
  id            String   @id @default(cuid())
  packageId     String
  package       MemberPackage @relation(fields: [packageId], references: [id])
  
  refundAmount  Decimal  @db.Decimal(12, 2)
  reason        String
  refundedBy    String
  refundedByUser User   @relation(fields: [refundedBy], references: [id])
  
  createdAt     DateTime @default(now())
  
  @@index([packageId])
  @@map("package_refunds")
}
```

#### 2.2 Add Cancel Reason to MemberPackage
```prisma
model MemberPackage {
  // ... existing fields
  cancelledAt   DateTime?
  cancelledBy   String?
  cancelReason  String?
  
  // ... rest of fields
}
```

---

### Phase 3: Frontend UI

#### 3.1 Package Actions Menu
Location: Member Detail Page → Packages Tab

```tsx
<PackageCard>
  <PackageInfo />
  <PackageActions>
    {status === 'PENDING_PAYMENT' && (
      <>
        <Button onClick={handleEdit}>✏️ Edit</Button>
        <Button onClick={handleCancel}>❌ Batalkan</Button>
      </>
    )}
    {status === 'ACTIVE' && (
      <Button onClick={handleRefund}>💰 Refund</Button>
    )}
  </PackageActions>
</PackageCard>
```

#### 3.2 Refund Modal
```tsx
<RefundModal>
  <Input label="Alasan Refund" required />
  <Input label="Jumlah Refund" type="number" defaultValue={finalPrice} />
  <Warning>
    Paket akan dibatalkan dan status menjadi CANCELLED.
    Sesi terapi yang sudah dilakukan tidak akan terpengaruh.
  </Warning>
  <Actions>
    <Button onClick={onCancel}>Batal</Button>
    <Button onClick={onConfirm} danger>Refund</Button>
  </Actions>
</RefundModal>
```

#### 3.3 Cancel Modal
```tsx
<CancelModal>
  <Input label="Alasan Pembatalan" required />
  <Warning>
    Invoice akan dibatalkan dan paket akan dihapus dari sistem.
  </Warning>
  <Actions>
    <Button onClick={onCancel}>Batal</Button>
    <Button onClick={onConfirm} danger>Batalkan</Button>
  </Actions>
</CancelModal>
```

#### 3.4 Edit Package Modal
```tsx
<EditPackageModal>
  <Input label="Jumlah Sesi" type="number" value={quantity} />
  <Input label="Diskon" type="number" value={discount} />
  <Input label="Catatan Diskon" value={discountNote} />
  <Textarea label="Catatan" value={notes} />
  <PriceCalculation>
    <Row>
      <Label>Harga Asli:</Label>
      <Value>Rp {originalPrice}</Value>
    </Row>
    <Row>
      <Label>Diskon:</Label>
      <Value>- Rp {discount}</Value>
    </Row>
    <Row>
      <Label>Total:</Label>
      <Value><strong>Rp {finalPrice}</strong></Value>
    </Row>
  </PriceCalculation>
  <Actions>
    <Button onClick={onCancel}>Batal</Button>
    <Button onClick={onSave}>Simpan</Button>
  </Actions>
</EditPackageModal>
```

#### 3.5 Member Incentive Display
```tsx
<MemberIncentiveCard>
  <Title>Insentif Referral</Title>
  <IncentiveRow>
    <Label>Pembelian Pertama:</Label>
    <Value>
      {firstIncentiveType === 'PERCENTAGE' 
        ? `${firstIncentiveValue}% (Rp ${calculateAmount(firstIncentiveValue, packagePrice)})`
        : `Rp ${firstIncentiveValue} (${calculatePercentage(firstIncentiveValue, packagePrice)}%)`
      }
    </Value>
  </IncentiveRow>
  <IncentiveRow>
    <Label>Pembelian Berikutnya:</Label>
    <Value>
      {nextIncentiveType === 'PERCENTAGE' 
        ? `${nextIncentiveValue}% (Rp ${calculateAmount(nextIncentiveValue, packagePrice)})`
        : `Rp ${nextIncentiveValue} (${calculatePercentage(nextIncentiveValue, packagePrice)}%)`
      }
    </Value>
  </IncentiveRow>
</MemberIncentiveCard>
```

---

## 📝 Business Rules

### Refund Rules
1. ✅ Hanya paket dengan status `ACTIVE` yang bisa di-refund
2. ✅ Refund amount tidak boleh melebihi `finalPrice`
3. ✅ Setelah refund, status paket menjadi `CANCELLED`
4. ✅ Sesi terapi yang sudah dilakukan tetap tercatat
5. ✅ Invoice status menjadi `CANCELLED`
6. ✅ Audit log mencatat siapa yang melakukan refund dan alasannya

### Cancel Rules
1. ✅ Hanya paket dengan status `PENDING_PAYMENT` yang bisa dibatalkan
2. ✅ Invoice terkait juga dibatalkan
3. ✅ Tidak ada refund karena belum ada pembayaran
4. ✅ Audit log mencatat pembatalan

### Edit Rules
1. ✅ Hanya paket dengan status `PENDING_PAYMENT` yang bisa diedit
2. ✅ Quantity tidak boleh 0 atau negatif
3. ✅ Discount tidak boleh melebihi original price
4. ✅ Final price harus > 0
5. ✅ Invoice amount juga diupdate
6. ✅ Audit log mencatat perubahan

### Incentive Display Rules
1. ✅ Tampilkan format: "Rp X (Y%)" untuk FIXED type
2. ✅ Tampilkan format: "Y% (Rp X)" untuk PERCENTAGE type
3. ✅ Hitung amount berdasarkan harga paket rata-rata atau paket terakhir
4. ✅ Jika belum ada paket, tampilkan "Belum ada pembelian"

---

## 🔐 Authorization

### Refund Package
- ✅ ADMIN_CABANG (own branch only)
- ✅ ADMIN_LAYANAN (own branch only)
- ❌ DOCTOR, NURSE (read-only)

### Cancel Package
- ✅ ADMIN_CABANG (own branch only)
- ✅ ADMIN_LAYANAN (own branch only)
- ❌ DOCTOR, NURSE (read-only)

### Edit Package
- ✅ ADMIN_CABANG (own branch only)
- ✅ ADMIN_LAYANAN (own branch only)
- ❌ DOCTOR, NURSE (read-only)

---

## 🧪 Testing Scenarios

### Scenario 1: Refund Active Package
1. Login as ADMIN_LAYANAN
2. Go to Member Detail
3. Find ACTIVE package
4. Click "Refund" button
5. Enter reason: "Member request refund"
6. Enter amount: Full amount
7. Confirm refund
8. ✅ Package status → CANCELLED
9. ✅ Invoice status → CANCELLED
10. ✅ Audit log created

### Scenario 2: Cancel Pending Package
1. Login as ADMIN_LAYANAN
2. Go to Member Detail
3. Find PENDING_PAYMENT package
4. Click "Batalkan" button
5. Enter reason: "Member changed mind"
6. Confirm cancellation
7. ✅ Package status → CANCELLED
8. ✅ Invoice status → CANCELLED
9. ✅ Audit log created

### Scenario 3: Edit Pending Package
1. Login as ADMIN_LAYANAN
2. Go to Member Detail
3. Find PENDING_PAYMENT package
4. Click "Edit" button
5. Change quantity from 10 to 12
6. Add discount: Rp 100.000
7. Add note: "Promo member baru"
8. Save changes
9. ✅ Package updated
10. ✅ Invoice amount updated
11. ✅ Audit log created

### Scenario 4: View Member Incentive
1. Login as ADMIN_LAYANAN
2. Go to Member Detail
3. View Incentive section
4. ✅ See "5% (Rp 50.000)" for first purchase
5. ✅ See "3% (Rp 30.000)" for next purchases
6. ✅ Calculation based on average package price

---

## 📊 Database Queries

### Get Editable Packages
```sql
SELECT * FROM member_packages
WHERE status = 'PENDING_PAYMENT'
  AND memberId = ?
  AND branchId = ?
ORDER BY createdAt DESC;
```

### Get Refundable Packages
```sql
SELECT * FROM member_packages
WHERE status = 'ACTIVE'
  AND memberId = ?
  AND branchId = ?
ORDER BY createdAt DESC;
```

### Calculate Average Package Price (for incentive display)
```sql
SELECT AVG(finalPrice) as avgPrice
FROM member_packages
WHERE memberId = ?
  AND status IN ('ACTIVE', 'EXPIRED')
  AND branchId = ?;
```

---

## 🚀 Implementation Priority

### Priority 1 (Must Have)
1. ✅ Cancel pending package
2. ✅ Edit pending package
3. ✅ Display incentive with amount + percentage

### Priority 2 (Should Have)
1. ✅ Refund active package
2. ✅ Audit logging for all actions
3. ✅ Authorization checks

### Priority 3 (Nice to Have)
1. ✅ Partial refund (less than full amount)
2. ✅ Refund history tracking
3. ✅ Email notification on refund/cancel

---

## 📁 Files to Create/Modify

### Backend
```
apps/api/src/modules/packages/
├── services/
│   ├── package-refund.service.ts (NEW)
│   ├── package-cancel.service.ts (NEW)
│   └── package-edit.service.ts (NEW)
├── packages.controller.ts (MODIFY - add endpoints)
├── packages.routes.ts (MODIFY - add routes)
└── packages.schema.ts (MODIFY - add validation)
```

### Frontend
```
apps/web/src/components/members/
├── PackageRefundModal.tsx (NEW)
├── PackageCancelModal.tsx (NEW)
├── PackageEditModal.tsx (NEW)
└── MemberIncentiveCard.tsx (NEW)

apps/web/src/app/(staff)/members/[memberId]/
└── page.tsx (MODIFY - add modals)
```

---

## 🎨 UI/UX Considerations

### Colors
- Refund button: Orange/Warning color
- Cancel button: Red/Danger color
- Edit button: Blue/Primary color

### Confirmations
- All destructive actions require confirmation
- Show clear warning messages
- Display affected data (amount, sessions, etc.)

### Loading States
- Show spinner during API calls
- Disable buttons during processing
- Show success/error toast messages

### Validation
- Client-side validation before API call
- Server-side validation for security
- Clear error messages

---

**Status**: Ready for Implementation  
**Estimated Time**: 2-3 days  
**Priority**: High  
**Dependencies**: None
