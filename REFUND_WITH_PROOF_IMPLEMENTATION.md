# Implementasi Refund dengan Bukti Gambar

## Overview
Menambahkan fitur upload bukti refund (gambar) ke MinIO dan menampilkan badge refund yang bisa diklik untuk melihat detail refund di halaman members.

## 1. Database Migration

Jalankan migration yang sudah dibuat:

```bash
cd apps/api
npx prisma migrate dev --name add_refund_fields
npx prisma generate
```

## 2. Backend Changes

### 2.1 Update Refund Schema (`apps/api/src/modules/packages/packages.schema.ts`)

```typescript
export const refundPackageSchema = z.object({
  reason: z.string().min(5, 'Alasan refund minimal 5 karakter'),
  refundAmount: z.number().min(0).optional(),
  // File akan dihandle oleh multer, tidak perlu di schema
});
```

### 2.2 Update Routes (`apps/api/src/modules/packages/packages.routes.ts`)

```typescript
import { uploadPaymentProof } from '../../middleware/upload';

// Update route refund untuk accept file upload
router.post(
  '/packages/:packageId/refund',
  authenticate,
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  uploadPaymentProof.single('refundProof'), // Tambahkan multer middleware
  controller.refundPackage.bind(controller)
);
```

### 2.3 Update Controller (`apps/api/src/modules/packages/packages.controller.ts`)

```typescript
async refundPackage(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('=== refundPackage controller called ===');
    console.log('packageId:', req.params.packageId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('File:', req.file);
    
    const { packageId } = req.params;
    const data = refundPackageSchema.parse(req.body);
    const { userId, branchId } = req.user!;
    
    // Get file from multer
    const refundProofFile = req.file;

    if (!branchId) {
      throw {
        status: 403,
        code: 'BRANCH_REQUIRED',
        message: 'Hanya staff cabang yang bisa melakukan refund',
      };
    }

    const result = await packagesService.refundPackage(
      packageId,
      {
        reason: data.reason,
        refundAmount: data.refundAmount,
      },
      userId,
      branchId,
      refundProofFile // Pass file to service
    );

    return sendSuccess(res, result);
  } catch (error) {
    console.log('refundPackage controller error:', error);
    next(error);
  }
}
```

### 2.4 Update Service (`apps/api/src/modules/packages/packages.service.ts`)

```typescript
async refundPackage(
  packageId: string,
  data: { reason: string; refundAmount?: number },
  userId: string,
  branchId: string | null,
  refundProofFile?: Express.Multer.File // Add file parameter
) {
  return await this.refundService.refundPackage(
    packageId,
    data,
    userId,
    branchId,
    refundProofFile
  );
}
```

### 2.5 Update Refund Service (`apps/api/src/modules/packages/services/package-refund.service.ts`)

Tambahkan di bagian atas:
```typescript
import { uploadFile } from '../../../config/minio';
```

Update method refundPackage:
```typescript
async refundPackage(
  packageId: string,
  data: RefundPackageInput,
  userId: string,
  branchId: string | null,
  refundProofFile?: Express.Multer.File
) {
  console.log('=== PackageRefundService.refundPackage called ===');
  console.log('packageId:', packageId);
  console.log('data:', JSON.stringify(data, null, 2));
  console.log('refundProofFile:', refundProofFile ? `${refundProofFile.originalname} (${refundProofFile.size} bytes)` : 'not provided');

  // ... existing validation code ...

  // Upload refund proof to MinIO if provided
  let refundProofUrl: string | undefined;
  let refundProofFileName: string | undefined;
  let refundProofFileSize: number | undefined;
  let refundProofMimeType: string | undefined;

  if (refundProofFile) {
    try {
      console.log('📤 [Refund] Uploading refund proof to MinIO...');
      const refundProofKey = `uploads/packages/${packageId}/refund-proof-${Date.now()}.${refundProofFile.mimetype.split('/')[1]}`;
      console.log('  - Key:', refundProofKey);
      console.log('  - MIME type:', refundProofFile.mimetype);
      
      const uploadResult = await uploadFile(
        refundProofFile.buffer,
        refundProofKey,
        refundProofFile.mimetype
      );
      
      console.log('  ✅ Refund proof uploaded to MinIO');
      console.log('  - URL:', uploadResult.url);
      
      refundProofUrl = uploadResult.url;
      refundProofFileName = refundProofFile.originalname;
      refundProofFileSize = refundProofFile.size;
      refundProofMimeType = refundProofFile.mimetype;
    } catch (error) {
      console.error('❌ [Refund] Failed to upload refund proof:', error);
      // Don't throw - allow refund to succeed even if file upload fails
    }
  }

  // Update packages with refund info
  await prisma.memberPackage.updateMany({
    where: { id: { in: packagesToRefund } },
    data: {
      status: 'CANCELLED',
      refundAmount: totalRefundAmount,
      refundReason: data.reason,
      refundProofUrl,
      refundProofFileName,
      refundProofFileSize,
      refundProofMimeType,
      refundedBy: userId,
      refundedAt: new Date(),
      notes: `[REFUND] ${data.reason}`,
      updatedAt: new Date(),
    },
  });

  // ... rest of existing code ...
}
```

### 2.6 Update Package Retrieval untuk Include Refund Data

Di `apps/api/src/modules/packages/services/package-retrieval.service.ts`, pastikan refund fields di-include:

```typescript
// Di method getMemberPackages, pastikan select include:
select: {
  // ... existing fields ...
  refundAmount: true,
  refundReason: true,
  refundProofUrl: true,
  refundProofFileName: true,
  refundProofFileSize: true,
  refundProofMimeType: true,
  refundedBy: true,
  refundedAt: true,
  refundedByUser: {
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          fullName: true,
        },
      },
    },
  },
}
```

## 3. Frontend Changes

### 3.1 Update Package Type (`apps/web/src/types/package.ts`)

```typescript
export interface PackageDisplay {
  // ... existing fields ...
  
  // Refund information
  refundAmount?: number;
  refundReason?: string;
  refundProofUrl?: string;
  refundProofFileName?: string;
  refundProofFileSize?: number;
  refundProofMimeType?: string;
  refundedBy?: string;
  refundedAt?: string;
  refundedByUser?: {
    id: string;
    email: string;
    profile?: {
      fullName: string;
    };
  };
}
```

### 3.2 Update PackageCard Component (`apps/web/src/components/members/PackageCard.tsx`)

Tambahkan badge refund yang bisa diklik:

```typescript
// Di bagian status badges, tambahkan:
{pkg.status === 'CANCELLED' && pkg.refundReason && (
  <button
    onClick={() => onViewRefund?.(pkg)}
    className={styles.refundBadge}
    title="Klik untuk melihat detail refund"
  >
    📝 [REFUND] {pkg.refundReason.substring(0, 30)}
    {pkg.refundReason.length > 30 ? '...' : ''}
  </button>
)}
```

Tambahkan CSS untuk refundBadge di `PackageCard.module.css`:

```css
.refundBadge {
  background: #ff6b6b;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
  margin-top: 8px;
}

.refundBadge:hover {
  background: #ff5252;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}
```

### 3.3 Create Refund Detail Modal (`apps/web/src/components/members/RefundDetailModal.tsx`)

```typescript
'use client';

import { useState } from 'react';
import { PackageDisplay } from '@/types/package';
import { getPresignedUrl } from '@/lib/membersApi';
import { showToast } from '@/lib/toast';
import { formatCurrency } from '@/lib/formatNumber';
import styles from './RefundDetailModal.module.css';

interface Props {
  package: PackageDisplay;
  onClose: () => void;
}

export default function RefundDetailModal({ package: pkg, onClose }: Props) {
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleViewProof = async () => {
    if (!pkg.refundProofUrl) return;

    try {
      setLoadingImage(true);
      const presignedUrl = await getPresignedUrl(pkg.refundProofUrl);
      setImageUrl(presignedUrl);
    } catch (err: any) {
      showToast.error('Gagal memuat bukti refund');
    } finally {
      setLoadingImage(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>📝 Detail Refund</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Package Info */}
          <div className={styles.section}>
            <h3>Informasi Paket</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.label}>Kode Paket:</span>
                <span className={styles.value}>{pkg.packageCode}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Tipe Paket:</span>
                <span className={styles.value}>{pkg.packageType}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Harga Paket:</span>
                <span className={styles.value}>{formatCurrency(pkg.finalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Refund Info */}
          <div className={styles.section}>
            <h3>Informasi Refund</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.label}>Jumlah Refund:</span>
                <span className={`${styles.value} ${styles.refundAmount}`}>
                  {formatCurrency(pkg.refundAmount || 0)}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Tanggal Refund:</span>
                <span className={styles.value}>
                  {pkg.refundedAt ? formatDate(pkg.refundedAt) : '-'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Diproses Oleh:</span>
                <span className={styles.value}>
                  {pkg.refundedByUser?.profile?.fullName || pkg.refundedByUser?.email || '-'}
                </span>
              </div>
            </div>

            <div className={styles.reasonBox}>
              <span className={styles.label}>Alasan Refund:</span>
              <p className={styles.reason}>{pkg.refundReason}</p>
            </div>
          </div>

          {/* Refund Proof */}
          {pkg.refundProofUrl && (
            <div className={styles.section}>
              <h3>Bukti Refund</h3>
              {!imageUrl ? (
                <button
                  onClick={handleViewProof}
                  disabled={loadingImage}
                  className={styles.viewProofButton}
                >
                  {loadingImage ? '⏳ Memuat...' : '👁️ Lihat Bukti Refund'}
                </button>
              ) : (
                <div className={styles.imageContainer}>
                  <img src={imageUrl} alt="Bukti Refund" className={styles.proofImage} />
                  <div className={styles.imageInfo}>
                    <span>📄 {pkg.refundProofFileName}</span>
                    <span>
                      💾 {((pkg.refundProofFileSize || 0) / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.closeFooterButton}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3.4 Create Modal CSS (`apps/web/src/components/members/RefundDetailModal.module.css`)

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.closeButton {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.closeButton:hover {
  background: #f5f5f5;
  color: #333;
}

.content {
  padding: 24px;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px 0;
}

.infoGrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.infoItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.value {
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.refundAmount {
  color: #ff6b6b;
  font-size: 16px;
}

.reasonBox {
  margin-top: 16px;
  padding: 16px;
  background: #fff3cd;
  border-left: 4px solid #ffc107;
  border-radius: 8px;
}

.reasonBox .label {
  display: block;
  margin-bottom: 8px;
  color: #856404;
}

.reason {
  margin: 0;
  font-size: 14px;
  color: #856404;
  line-height: 1.6;
}

.viewProofButton {
  width: 100%;
  padding: 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.viewProofButton:hover:not(:disabled) {
  background: #0056b3;
}

.viewProofButton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.imageContainer {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.proofImage {
  width: 100%;
  height: auto;
  display: block;
}

.imageInfo {
  padding: 12px;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.footer {
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
}

.closeFooterButton {
  padding: 10px 24px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.closeFooterButton:hover {
  background: #5a6268;
}
```

### 3.5 Update Member Detail Page untuk Handle Refund Modal

Di `apps/web/src/app/(staff)/members/[memberId]/page.tsx`, tambahkan:

```typescript
// Add state for refund modal
const [showRefundDetailModal, setShowRefundDetailModal] = useState(false);
const [selectedRefundPackage, setSelectedRefundPackage] = useState<PackageDisplay | null>(null);

// Add handler
const handleViewRefund = (pkg: PackageDisplay) => {
  setSelectedRefundPackage(pkg);
  setShowRefundDetailModal(true);
};

// Pass to MemberPackagesTab
<MemberPackagesTab
  packages={packages}
  loading={loadingPackages}
  onAssignPackage={() => setShowAssignModal(true)}
  onVerifyPackage={handleVerifyPackage}
  onRefundPackage={handleRefundPackage}
  onCancelPackage={handleCancelPackage}
  onEditPackage={handleEditPackage}
  onViewRefund={handleViewRefund} // Add this
/>

// Add modal at the end
{showRefundDetailModal && selectedRefundPackage && (
  <RefundDetailModal
    package={selectedRefundPackage}
    onClose={() => {
      setShowRefundDetailModal(false);
      setSelectedRefundPackage(null);
    }}
  />
)}
```

### 3.6 Update Refund Modal untuk Upload File

Di modal refund yang sudah ada, tambahkan file input:

```typescript
const [refundProof, setRefundProof] = useState<File | null>(null);
const [refundProofPreview, setRefundProofPreview] = useState<string | null>(null);

const handleRefundProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 5MB');
      return;
    }
    setRefundProof(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setRefundProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
};

// Di form, tambahkan:
<div>
  <label>Bukti Refund (Opsional)</label>
  <input
    type="file"
    accept="image/*"
    onChange={handleRefundProofChange}
  />
  {refundProofPreview && (
    <img src={refundProofPreview} alt="Preview" style={{ maxWidth: '200px', marginTop: '8px' }} />
  )}
</div>

// Update submit handler untuk include file
const handleSubmit = async () => {
  const formData = new FormData();
  formData.append('reason', refundReason);
  formData.append('refundAmount', refundAmount.toString());
  if (refundProof) {
    formData.append('refundProof', refundProof);
  }

  await packagesApi.refundPackage(selectedPackageId, formData);
};
```

### 3.7 Update Packages API (`apps/web/src/lib/packagesApi.ts`)

```typescript
async refundPackage(packageId: string, data: FormData): Promise<void> {
  await api.post(`/packages/${packageId}/refund`, data);
}
```

## 4. Testing Checklist

- [ ] Run migration: `npx prisma migrate dev`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Restart backend server
- [ ] Restart frontend server
- [ ] Test refund dengan upload bukti gambar
- [ ] Test refund tanpa upload bukti gambar
- [ ] Test klik badge refund untuk melihat detail
- [ ] Test view bukti refund di modal
- [ ] Test refund untuk bundle packages

## 5. Notes

- Bukti refund bersifat opsional
- File maksimal 5MB
- Format yang diterima: JPG, PNG, WebP, GIF, BMP
- File disimpan di MinIO dengan path: `uploads/packages/{packageId}/refund-proof-{timestamp}.{ext}`
- Badge refund hanya muncul untuk paket dengan status CANCELLED yang memiliki refundReason
