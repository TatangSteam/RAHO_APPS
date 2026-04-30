# Update: Referral Code Dropdown dengan Search

## Perubahan yang Dilakukan

### ✅ Fitur Baru
Field "Kode Referral" pada form pendaftaran member baru telah diubah dari dropdown biasa menjadi **searchable dropdown** dengan fitur:

1. **Input Search**: User dapat mengetik untuk mencari kode referral
2. **Filter Real-time**: Hasil pencarian difilter berdasarkan:
   - Kode referral (contoh: REF-001)
   - Nama referrer (contoh: Dr. Budi)
   - Tipe referrer (contoh: DOKTER, SALES, MEMBER)
3. **Dropdown List**: Menampilkan semua referral code dari cabang tersebut
4. **Visual Feedback**: Item yang dipilih ditandai dengan highlight
5. **Auto-close**: Dropdown otomatis tertutup saat klik di luar

### 📁 File yang Diubah

#### 1. `apps/web/src/components/branches/MemberCrudModal.tsx`
**State Baru:**
```typescript
const [filteredReferralCodes, setFilteredReferralCodes] = useState<any[]>([]);
const [referralSearch, setReferralSearch] = useState('');
const [showReferralDropdown, setShowReferralDropdown] = useState(false);
```

**Fungsi Baru:**
- `handleReferralSelect()` - Menangani pemilihan referral code
- `handleReferralSearchChange()` - Menangani perubahan input search
- Filter effect untuk real-time search
- Click outside handler untuk menutup dropdown

**UI Changes:**
- Mengganti `<select>` dengan `<input>` + custom dropdown
- Dropdown menampilkan:
  - Kode referral (warna primary)
  - Nama referrer (bold)
  - Tipe referrer (uppercase, secondary color)

#### 2. `apps/web/src/styles/crud-modal.module.css`
**Style Baru:**
- `.dropdownList` - Container dropdown
- `.dropdownItem` - Item dalam dropdown
- `.dropdownItemSelected` - Item yang dipilih
- `.dropdownItemContent` - Layout konten item
- `.dropdownCode` - Style untuk kode referral
- `.dropdownName` - Style untuk nama referrer
- `.dropdownType` - Style untuk tipe referrer
- `.dropdownEmpty` - Pesan ketika tidak ada hasil
- Custom scrollbar untuk dropdown

### 🎨 Tampilan UI

**Before:**
```
┌─────────────────────────────────────┐
│ Kode Referral                    ▼ │
│ [Dropdown Select]                   │
└─────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────┐
│ Kode Referral (Optional)            │
│ [Ketik untuk mencari...]            │
│ ┌─────────────────────────────────┐ │
│ │ - Tidak ada referral            │ │
│ │ REF-001                         │ │
│ │ Dr. Budi Santoso                │ │
│ │ DOKTER                          │ │
│ │─────────────────────────────────│ │
│ │ REF-002                         │ │
│ │ Sales Team Jakarta              │ │
│ │ SALES                           │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 🔍 Cara Kerja Search

1. **User mengetik**: "budi"
2. **Filter berjalan**: Mencari di code, name, dan type
3. **Hasil ditampilkan**: Hanya referral yang match
4. **User klik item**: Dropdown tertutup, value tersimpan

### 📊 Data Flow

```
User Input → handleReferralSearchChange()
    ↓
Update referralSearch state
    ↓
useEffect filter trigger
    ↓
Filter referralCodes array
    ↓
Update filteredReferralCodes
    ↓
Re-render dropdown list
```

### 🎯 Keuntungan

1. **UX Lebih Baik**: User tidak perlu scroll panjang di dropdown
2. **Pencarian Cepat**: Langsung ketik nama atau kode
3. **Visual Jelas**: Informasi lengkap (code, name, type) terlihat
4. **Responsive**: Bekerja baik di desktop dan mobile
5. **Accessible**: Keyboard navigation support

### 🧪 Testing Checklist

- [ ] Buka halaman branch detail
- [ ] Klik tab "Members"
- [ ] Klik tombol "Tambah Member"
- [ ] Lihat field "Kode Referral (Optional)"
- [ ] Klik input field → dropdown muncul
- [ ] Ketik "REF" → filter bekerja
- [ ] Ketik nama referrer → filter bekerja
- [ ] Pilih salah satu item → dropdown tertutup
- [ ] Input menampilkan "CODE - NAME"
- [ ] Klik di luar dropdown → dropdown tertutup
- [ ] Submit form → referralCodeId tersimpan

### 🔧 Technical Details

**Search Algorithm:**
```typescript
const filtered = referralCodes.filter((ref) => 
  ref.code.toLowerCase().includes(searchLower) ||
  ref.referrerName.toLowerCase().includes(searchLower) ||
  ref.referrerType.toLowerCase().includes(searchLower)
);
```

**Click Outside Handler:**
```typescript
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('#referralSearch') && 
      !target.closest(`.${styles.dropdownList}`)) {
    setShowReferralDropdown(false);
  }
};
```

### 📝 Notes

- Dropdown hanya muncul saat **action === 'create'**
- Field tetap optional (bisa kosong)
- Data referral diload dari API: `getActiveReferrals(branchId)`
- Hanya menampilkan referral code yang aktif dari cabang tersebut
- Incentive section tetap muncul jika referral code dipilih

### 🚀 Next Steps

1. Test di browser dengan hard refresh
2. Coba search dengan berbagai keyword
3. Verify data tersimpan dengan benar
4. Test di mobile view
5. Test dengan banyak referral codes (scroll behavior)

## Summary

Field referral code sekarang lebih user-friendly dengan fitur search yang memudahkan user menemukan kode referral yang tepat tanpa harus scroll panjang di dropdown biasa. UI menggunakan RAHO dark theme dengan visual yang jelas dan konsisten.
