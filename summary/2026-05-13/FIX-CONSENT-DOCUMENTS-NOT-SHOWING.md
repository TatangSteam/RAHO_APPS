# Fix: Dokumen Persetujuan Tidak Muncul di Profil Member

**Tanggal:** 13 Mei 2026  
**Status:** ✅ Selesai

## 🐛 Masalah

Dokumen Persetujuan Setelah Penjelasan (PSP) yang sudah di-upload tidak muncul di halaman profil detail member, meskipun dokumen sudah tersimpan di database dan MinIO.

## 🔍 Root Cause Analysis

### 1. **Dokumen Sudah Tersimpan dengan Benar**
- Upload dokumen PSP berfungsi normal saat registrasi member
- Data tersimpan di tabel `member_documents` dengan `documentType = 'PERSETUJUAN_SETELAH_PENJELASAN'`
- File tersimpan di MinIO dengan path: `uploads/members/{memberId}/documents/psp-{timestamp}.{ext}`

### 2. **API Endpoint Sudah Benar**
- `GET /api/v1/members/:memberId` sudah include `documents: true`
- Method `formatMemberDetailData()` sudah mengembalikan array `documents` dengan benar
- Endpoint khusus `GET /api/v1/members/:memberId/documents/consent` juga sudah ada

### 3. **Masalah di Frontend**
Ditemukan 2 masalah di `MemberProfileTab.tsx`:

**Masalah A: Direct File URL Access**
```typescript
// ❌ SALAH - Menggunakan fileUrl langsung tanpa presigned URL
<a href={doc.fileUrl} target="_blank">
  👁️ Lihat File
</a>
```

File di MinIO memerlukan presigned URL untuk akses, tidak bisa diakses langsung dengan permanent URL.

**Masalah B: Image Preview Tidak Berfungsi**
```typescript
// ❌ SALAH - Mencoba load image langsung dari MinIO
{doc.mimeType.startsWith('image/') && (
  <img src={doc.fileUrl} alt={doc.fileName} />
)}
```

Image juga memerlukan presigned URL untuk ditampilkan.

### 4. **Masalah di Backend**
File path yang di-encode di frontend tidak di-decode di backend:

```typescript
// Frontend mengirim: /files/presign/uploads%2Fmembers%2Fxxx%2Fdocuments%2Fpsp-123.pdf
// Backend menerima: uploads%2Fmembers%2Fxxx%2Fdocuments%2Fpsp-123.pdf (masih encoded)
// MinIO mencari: uploads%2Fmembers%2Fxxx%2Fdocuments%2Fpsp-123.pdf (SALAH!)
// Seharusnya: uploads/members/xxx/documents/psp-123.pdf
```

## ✅ Solusi

### 1. **Frontend: MemberProfileTab.tsx**

**Perubahan A: Tambah State dan Handler**
```typescript
const [loadingDocUrl, setLoadingDocUrl] = useState<string | null>(null);

const handleViewDocument = async (fileUrl: string, fileName: string) => {
  try {
    setLoadingDocUrl(fileUrl);
    const presignedUrl = await getPresignedUrl(fileUrl);
    window.open(presignedUrl, '_blank');
  } catch (err: any) {
    // Error handling dengan mapping error codes
    showToast.error('Gagal membuka dokumen');
  } finally {
    setLoadingDocUrl(null);
  }
};
```

**Perubahan B: Update UI untuk Dokumen**
```typescript
// ✅ BENAR - Menggunakan button dengan presigned URL
<button
  type="button"
  onClick={() => handleViewDocument(doc.fileUrl, doc.fileName)}
  disabled={loadingDocUrl === doc.fileUrl}
  className="btn btn-sm btn-primary btn-full"
>
  {loadingDocUrl === doc.fileUrl ? '⏳ Memuat...' : '👁️ Lihat File'}
</button>
```

**Perubahan C: Hapus Image Preview**
- Dihapus karena memerlukan presigned URL yang expire
- Untuk preview image, perlu implementasi terpisah dengan auto-refresh presigned URL

### 2. **Backend: files.controller.ts**

**Perubahan: Decode URL-encoded Path**
```typescript
async presignFile(req: Request, res: Response, next: NextFunction) {
  let key = req.params[0];
  
  // Decode the key in case it was URL-encoded by the client
  key = decodeURIComponent(key);
  
  const url = await this.filesService.getPresignedUrl(key, expires);
  return res.json({ success: true, data: { url } });
}
```

## 📋 Files Changed

### Frontend
- `apps/web/src/components/members/MemberProfileTab.tsx`
  - Tambah import: `useState`, `getPresignedUrl`, `showToast`
  - Tambah state: `loadingDocUrl`
  - Tambah handler: `handleViewDocument()`
  - Update UI: Ganti `<a>` dengan `<button>` yang memanggil handler
  - Hapus: Image preview untuk dokumen

### Backend
- `apps/api/src/modules/files/files.controller.ts`
  - Tambah: `decodeURIComponent(key)` di method `presignFile()`

## 🧪 Testing

### Test Case 1: View Dokumen PSP
1. Buka halaman member detail
2. Klik tab "Profil"
3. Scroll ke bagian "📄 Dokumen"
4. Klik tombol "👁️ Lihat File" pada dokumen PSP
5. **Expected:** Dokumen terbuka di tab baru
6. **Actual:** ✅ Dokumen terbuka dengan benar

### Test Case 2: View Foto Member
1. Buka halaman member detail
2. Klik tab "Profil"
3. Scroll ke bagian "📄 Dokumen"
4. Klik tombol "👁️ Lihat File" pada foto member
5. **Expected:** Foto terbuka di tab baru
6. **Actual:** ✅ Foto terbuka dengan benar

### Test Case 3: Loading State
1. Buka halaman member detail dengan koneksi lambat
2. Klik tombol "👁️ Lihat File"
3. **Expected:** Tombol berubah menjadi "⏳ Memuat..." dan disabled
4. **Actual:** ✅ Loading state berfungsi dengan benar

### Test Case 4: Error Handling
1. Hapus file dari MinIO secara manual
2. Coba buka dokumen
3. **Expected:** Toast error muncul dengan pesan yang sesuai
4. **Actual:** ✅ Error handling berfungsi dengan benar

## 📊 Impact Analysis

### Positive Impact
- ✅ Dokumen PSP sekarang bisa dilihat oleh staff
- ✅ Foto member bisa dilihat dengan benar
- ✅ Loading state memberikan feedback yang jelas
- ✅ Error handling yang lebih baik dengan pesan yang user-friendly
- ✅ Security tetap terjaga dengan presigned URL yang expire

### Potential Issues
- ⚠️ Presigned URL expire setelah 60 detik (default)
  - **Mitigasi:** User harus klik tombol lagi jika URL sudah expire
- ⚠️ Tidak ada image preview di card
  - **Mitigasi:** User bisa klik "Lihat File" untuk melihat full image
  - **Future:** Implementasi image preview dengan auto-refresh presigned URL

## 🔄 Related Features

### Existing Features yang Terpengaruh
1. **ConsentDocumentsSection Component**
   - Sudah menggunakan presigned URL dengan benar
   - Tidak perlu perubahan

2. **Member Registration**
   - Upload dokumen PSP sudah berfungsi dengan benar
   - Tidak perlu perubahan

3. **File Upload Service**
   - Sudah menyimpan file dengan benar di MinIO
   - Tidak perlu perubahan

### Future Enhancements
1. **Image Preview dengan Auto-refresh**
   - Implementasi component yang auto-refresh presigned URL sebelum expire
   - Gunakan `useEffect` dengan interval untuk refresh URL

2. **Download Button**
   - Tambah tombol download terpisah dari view
   - Gunakan `<a download>` dengan presigned URL

3. **Bulk Document View**
   - Implementasi lightbox/gallery untuk melihat multiple dokumen
   - Navigasi prev/next antar dokumen

## 📝 Notes

### Why Not Use Direct MinIO URL?
MinIO memerlukan autentikasi untuk akses file. Ada 2 opsi:
1. **Public Bucket** - File bisa diakses tanpa auth (❌ tidak aman)
2. **Presigned URL** - URL temporary dengan auth built-in (✅ aman)

Kita menggunakan presigned URL untuk keamanan.

### Why Encode/Decode URL?
File path mengandung karakter `/` yang perlu di-encode saat dikirim via URL:
- Original: `uploads/members/xxx/documents/psp-123.pdf`
- Encoded: `uploads%2Fmembers%2Fxxx%2Fdocuments%2Fpsp-123.pdf`
- Backend harus decode kembali untuk mendapatkan path yang benar

### Why Remove Image Preview?
Image preview memerlukan presigned URL yang expire. Untuk menampilkan image preview yang persistent, perlu implementasi yang lebih kompleks dengan auto-refresh URL. Untuk saat ini, user bisa klik "Lihat File" untuk melihat image di tab baru.

## ✅ Checklist

- [x] Identifikasi root cause
- [x] Implementasi fix di frontend
- [x] Implementasi fix di backend
- [x] Testing manual
- [x] Verifikasi tidak ada regression
- [x] Dokumentasi
- [ ] Testing di production (pending deployment)

## 🚀 Deployment Notes

### Pre-deployment Checklist
- [x] Code review
- [x] Local testing
- [ ] Staging testing
- [ ] Production deployment

### Rollback Plan
Jika terjadi masalah setelah deployment:
1. Revert commit di frontend: `git revert <commit-hash>`
2. Revert commit di backend: `git revert <commit-hash>`
3. Redeploy versi sebelumnya

### Monitoring
Setelah deployment, monitor:
- Error rate di endpoint `/files/presign/*`
- User complaints tentang dokumen tidak bisa dibuka
- MinIO access logs untuk failed requests
