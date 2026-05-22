# Export Builder Modal - Data Member

**Tanggal**: 22 Mei 2026  
**Status**: ✅ Selesai

## Deskripsi

Implementasi fitur Export Builder Modal untuk data member dengan kemampuan kustomisasi seperti ERP, termasuk:
- Quick Export presets
- Custom filters (cabang, status, tanggal, gender, usia, tipe paket)
- Column picker dengan kategori
- Grouping dan sorting
- Subtotal dan grand total
- Data terapi (total sesi, sesi selesai, tanggal terapi terakhir)

## Fitur Utama

### 1. Quick Export (Tab Pertama)
- **Semua Data**: Export semua kolom
- **Ringkasan**: Data dasar dan kontak saja
- **Data Paket Aktif**: Member dengan paket aktif beserta detail
- **Member Baru**: Member terdaftar dengan info referral

### 2. Custom Export (Tab Kedua)

#### Filter Data
- **Cabang**: Multi-select untuk SUPER_ADMIN dan ADMIN_MANAGER
- **Status**: Aktif/Nonaktif
- **Jenis Kelamin**: L/P
- **Tanggal Registrasi**: Range dari-sampai
- **Tipe Paket**: BASIC/BOOSTER
- **Usia**: Range minimal-maksimal

#### Pilih Kolom (6 Kategori)
1. **📋 Data Dasar**: No. Member, Nama, NIK, Tempat/Tanggal Lahir, Gender, Status Nikah, Pekerjaan, Cabang, Status, Tanggal Registrasi
2. **📞 Kontak**: Telepon, Email, Alamat, Kode Pos, Kontak Darurat
3. **📦 Paket**: Jumlah Paket Aktif, Total Sesi Tersisa, Detail Paket
4. **🏥 Medis**: Sumber Info RAHO, Persetujuan Foto, Jumlah Diagnosis, Diagnosis Terakhir
5. **🔗 Referral**: Kode Referral, Nama Referrer, Tipe Referrer
6. **💉 Data Terapi**: Total Sesi Terapi, Sesi Selesai, Tanggal Terapi Terakhir

#### Pengaturan Tampilan
- **Kelompokkan Berdasarkan**: Cabang, Tipe Paket, Bulan Registrasi, Gender, Referral
- **Urutkan Berdasarkan**: No. Member, Nama, Tanggal Registrasi, Terapi Terakhir
- **Subtotal per Grup**: Checkbox
- **Grand Total**: Checkbox

### 3. Format Output
- **Excel (XLSX)**: Dengan styling, grouping, dan totals
- **CSV**: Plain text format

### 4. Preview
- Menampilkan jumlah member yang akan di-export berdasarkan filter

## File yang Diubah

### Frontend
- `apps/web/src/components/members/ExportMembersModal.tsx` - **Rewrite lengkap**

### Backend
- `apps/api/src/modules/members/services/member-export.service.ts` - **Rewrite lengkap**
- `apps/api/src/modules/members/members.controller.ts` - Update `exportMembers()`, tambah `getExportPreview()`
- `apps/api/src/modules/members/members.routes.ts` - Tambah route `/export/preview`

## Cara Penggunaan

1. Buka halaman **Manajemen Member** (`/members`)
2. Klik tombol **📥 Export Data**
3. Pilih tab **Quick Export** untuk preset cepat, atau **Custom Export** untuk kustomisasi
4. Pada Custom Export:
   - Set filter sesuai kebutuhan
   - Pilih kolom yang ingin di-export
   - Atur grouping dan sorting jika diperlukan
   - Aktifkan subtotal/grand total jika menggunakan grouping
5. Pilih format (Excel/CSV)
6. Klik **Export**

## Akses Role

- **SUPER_ADMIN**: Akses penuh, bisa filter semua cabang
- **ADMIN_MANAGER**: Akses penuh, bisa filter cabang yang dikelola
- **ADMIN_CABANG**: Akses terbatas ke cabang sendiri
- **ADMIN_LAYANAN**: Akses terbatas ke cabang sendiri
- **DOCTOR/NURSE**: Tidak bisa export (tombol hidden)

## Catatan Teknis

- Menggunakan ExcelJS untuk generate XLSX dengan styling
- Preview count menggunakan endpoint terpisah untuk performa
- Session stats diambil via Encounter → TreatmentSession relation
- Grouping di Excel menggunakan merged cells dan styling berbeda
