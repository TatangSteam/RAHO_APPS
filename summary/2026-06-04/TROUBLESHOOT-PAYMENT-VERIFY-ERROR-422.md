# Troubleshoot: Payment Verify Error 422

**Date**: 4 Juni 2026  
**Issue**: Error 422 saat verify payment paket meskipun sudah upload bukti bayar  
**Error Message**: "Paket tidak dalam status menunggu verifikasi"  
**Package ID**: `cmpyyktru000aokuz8zzqhgh8`

---

## 🔍 Root Cause Analysis

Error 422 terjadi karena validasi di `payment-verification.service.ts` line 30-35:

```typescript
if (pkg.status !== PackageStatus.WAITING_VERIFICATION) {
  throw {
    status: 422,
    code: 'PACKAGE_NOT_WAITING_VERIFICATION',
    message: 'Paket tidak dalam status menunggu verifikasi',
  };
}
```

**Expected Flow**:
1. Member upload bukti bayar → Status berubah `PENDING_PAYMENT` → `WAITING_VERIFICATION`
2. Admin verify → Status berubah `WAITING_VERIFICATION` → `ACTIVE`

**Kemungkinan Penyebab**:

### 1. **Upload Gagal Tapi UI Tidak Menampilkan Error**
- File terlalu besar
- Network timeout
- MinIO connection error
- Status tetap `PENDING_PAYMENT`

### 2. **Wrong Package ID**
- User mencoba verify package ID yang berbeda
- Confusion antara main package dan add-on

### 3. **Race Condition / Cache Issue**
- Upload sukses tapi frontend belum refresh
- Browser cache menampilkan data lama

### 4. **Database Inconsistency**
- Upload sukses, file tersimpan, tapi status tidak ter-update di database
- Transaction rollback partial

---

## 🛠️ Diagnostic Steps

### Step 1: Check Package Status

Jalankan query di database:

```sql
SELECT 
  id, 
  packageCode,
  packageType,
  status,
  paymentProofUrl,
  paymentProofFileName,
  createdAt,
  updatedAt
FROM member_packages 
WHERE id = 'cmpyyktru000aokuz8zzqhgh8';
```

**Expected Result**:
- Status = `WAITING_VERIFICATION`
- `paymentProofUrl` NOT NULL
- `paymentProofFileName` NOT NULL

**If Status = `PENDING_PAYMENT`**:
- Upload failed atau stuck
- Proceed to Step 2

**If Status = `ACTIVE`**:
- Paket sudah di-verify sebelumnya
- No action needed

### Step 2: Check Upload History

```sql
-- Cek apakah file pernah di-upload (ada di database)
SELECT 
  id,
  packageCode,
  status,
  paymentProofUrl,
  paymentProofFileName,
  paymentProofFileSize,
  updatedAt
FROM member_packages 
WHERE id = 'cmpyyktru000aokuz8zzqhgh8';
```

**Scenario A**: `paymentProofUrl` IS NULL
- ✅ Upload memang gagal
- Member harus upload ulang

**Scenario B**: `paymentProofUrl` IS NOT NULL tapi status `PENDING_PAYMENT`
- ❌ Database inconsistency
- Proceed to Step 3 (Manual Fix)

### Step 3: Check Purchase Group

```sql
-- Cek apakah paket ini bagian dari group purchase
SELECT 
  id,
  packageCode,
  status,
  purchaseGroupId,
  paymentProofFileName
FROM member_packages 
WHERE purchaseGroupId = (
  SELECT purchaseGroupId FROM member_packages WHERE id = 'cmpyyktru000aokuz8zzqhgh8'
)
AND purchaseGroupId IS NOT NULL;
```

**If Group Purchase**:
- All packages in group harus status `WAITING_VERIFICATION`
- Jika ada 1 package stuck, semua affected

### Step 4: Check API Logs

Di terminal API, cari error upload:

```
POST /api/v1/me/packages/:packageId/upload-payment-proof
```

Possible errors:
- `FILE_UPLOAD_FAILED` - MinIO error
- `PACKAGE_NOT_FOUND` - Wrong package ID
- `500` - Database transaction error

---

## 🔧 Solutions

### Solution 1: Manual Database Fix (If Stuck)

**Condition**: `paymentProofUrl` IS NOT NULL tapi status masih `PENDING_PAYMENT`

```sql
-- 1. Verify data first
SELECT id, packageCode, status, paymentProofFileName 
FROM member_packages 
WHERE status = 'PENDING_PAYMENT' 
AND paymentProofUrl IS NOT NULL;

-- 2. Fix stuck packages
UPDATE member_packages 
SET status = 'WAITING_VERIFICATION'
WHERE status = 'PENDING_PAYMENT' 
AND paymentProofUrl IS NOT NULL;

-- 3. Verify fix
SELECT id, packageCode, status 
FROM member_packages 
WHERE id = 'cmpyyktru000aokuz8zzqhgh8';
```

✅ **After Fix**: Admin dapat verify payment seperti biasa

### Solution 2: Re-upload (If Upload Failed)

**Condition**: `paymentProofUrl` IS NULL

Instruksi untuk Member:
1. Buka halaman Member Portal → My Packages
2. Klik package yang pending
3. Upload ulang bukti bayar
4. Tunggu admin verify

### Solution 3: Check MinIO Connection

**Condition**: Repeated upload failures

```bash
# Test MinIO connection
curl http://localhost:9000/minio/health/live

# Check MinIO env vars
cat apps/api/.env | grep MINIO
```

Expected env vars:
```
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=raho-uploads
```

### Solution 4: Code Fix (Prevention)

Add better error handling di `uploadPaymentProofService`:

```typescript
// BEFORE
await prisma.memberPackage.update({
  where: { id: packageId },
  data: {
    status: 'WAITING_VERIFICATION',
    paymentProofUrl: fileUrl,
    // ...
  }
});

// AFTER (dengan transaction & error handling)
try {
  await prisma.$transaction(async (tx) => {
    await tx.memberPackage.update({
      where: { id: packageId },
      data: {
        status: 'WAITING_VERIFICATION',
        paymentProofUrl: fileUrl,
        paymentProofFileName: file.originalname,
        paymentProofFileSize: file.size,
        paymentProofMimeType: file.mimetype,
      }
    });
    
    // Log audit
    await tx.auditLog.create({
      data: {
        userId: memberPackage.member.id,
        action: 'UPDATE',
        resource: 'MemberPackage',
        resourceId: packageId,
        meta: { action: 'UPLOAD_PAYMENT_PROOF', fileName: file.originalname }
      }
    });
  });
} catch (error) {
  // Rollback file upload if database update fails
  // TODO: Implement MinIO delete
  throw {
    status: 500,
    code: 'DATABASE_UPDATE_FAILED',
    message: 'Gagal mengupdate status paket setelah upload'
  };
}
```

---

## 📋 Testing Checklist

After applying fix:

- [ ] Member dapat upload bukti bayar
- [ ] Status berubah ke `WAITING_VERIFICATION`
- [ ] Admin dapat verify payment
- [ ] Status berubah ke `ACTIVE`
- [ ] Invoice ter-generate otomatis
- [ ] Payment record created dengan proof file
- [ ] Member menerima notifikasi

---

## 🚨 Common Mistakes

### Mistake 1: Verify Wrong Package ID
```
User: "Saya sudah upload tapi tidak bisa verify"
Admin: *Verify package yang berbeda*
```

**Solution**: Pastikan package ID yang di-verify sama dengan yang di-upload

### Mistake 2: Double Upload
```
User upload 2x karena thinking gagal → 2 packages dengan proof berbeda
```

**Solution**: UI harus disable upload button after submit

### Mistake 3: Verify Before Upload
```
Admin: "Package masih PENDING_PAYMENT"
Member: "Saya sudah bayar!"
```

**Solution**: Member harus upload bukti bayar dulu di portal

---

## 📊 Monitoring Query

Untuk monitor stuck packages:

```sql
-- Packages stuck dengan payment proof tapi status masih PENDING_PAYMENT
SELECT 
  id,
  packageCode,
  memberNo,
  status,
  paymentProofFileName,
  DATE(updatedAt) as last_updated
FROM member_packages mp
INNER JOIN members m ON mp.memberId = m.id
WHERE mp.status = 'PENDING_PAYMENT'
AND mp.paymentProofUrl IS NOT NULL
ORDER BY mp.updatedAt DESC;

-- Alert jika ada stuck > 1 jam
SELECT COUNT(*) as stuck_count
FROM member_packages
WHERE status = 'PENDING_PAYMENT'
AND paymentProofUrl IS NOT NULL
AND updatedAt < NOW() - INTERVAL 1 HOUR;
```

---

## 🎯 Prevention Recommendations

1. **Add Transaction Wrapping**: Wrap upload + database update dalam single transaction
2. **Add Retry Logic**: Retry upload 3x jika gagal
3. **Better Error Messages**: Return specific error untuk user
4. **Add Audit Log**: Log setiap upload attempt
5. **Add Status Validation**: Frontend check status sebelum allow upload
6. **Add Monitoring**: Alert jika ada stuck packages > 1 jam

---

## 📝 Files to Check

- **Upload Service**: `apps/api/src/modules/me/me.service.ts` (line 810-862)
- **Verify Service**: `apps/api/src/modules/packages/services/payment-verification.service.ts` (line 16-77)
- **Upload Endpoint**: `apps/api/src/modules/me/me.routes.ts` (line 91-104)
- **Verify Endpoint**: `apps/api/src/modules/packages/packages.routes.ts`

---

**Status**: Waiting for user to run diagnostic queries  
**Next Action**: Run `DEBUG-PACKAGE-STATUS.sql` dan report hasilnya
