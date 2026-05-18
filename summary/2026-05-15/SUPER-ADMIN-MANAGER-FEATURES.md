# Super Admin - Admin Manager Management Features

**Tanggal**: 15 Mei 2026  
**Status**: ✅ Completed

## 📋 Overview

Fitur lengkap untuk Super Admin dalam mengelola Admin Manager, termasuk:
1. **Melihat List Admin Manager** dengan filtering dan pagination
2. **Membuat Admin Manager Baru** dengan assignment cabang
3. **Impersonate Admin Manager** untuk testing dan support

---

## 🎯 Fitur yang Diimplementasikan

### 1. **Admin Managers Tab**
Komponen utama untuk menampilkan dan mengelola Admin Manager.

**File**: `apps/web/src/components/admin/AdminManagersTab.tsx`

**Fitur**:
- ✅ List semua Admin Manager dengan pagination
- ✅ Search by nama atau email
- ✅ Filter by status (Active/Inactive)
- ✅ Tampilkan statistik (Total, Active, Branches Assigned)
- ✅ Tampilkan branches yang di-assign ke setiap manager
- ✅ Button untuk create Admin Manager baru
- ✅ Button untuk impersonate Admin Manager
- ✅ Button untuk edit dan deactivate (UI ready, logic TBD)

**Stats Cards**:
- Total Admin Manager
- Admin Manager Aktif
- Total Branches Assigned

**Table Columns**:
- Nama (dengan avatar)
- Email
- Status (Active/Inactive badge)
- Branches (dengan tooltip detail)
- Tanggal Dibuat
- Login Terakhir
- Aksi (Impersonate, Edit, Deactivate)

---

### 2. **Create Admin Manager Modal**
Modal untuk membuat Admin Manager baru dengan form lengkap.

**File**: `apps/web/src/components/admin/CreateAdminManagerModal.tsx`

**Form Fields**:
- ✅ Nama Lengkap (required)
- ✅ Email (required, validated)
- ✅ Nomor Telepon (required, validated)
- ✅ Password (required, min 8 chars, show/hide toggle)
- ✅ Branch Assignment (required, multi-select dengan checkbox)

**Features**:
- ✅ Real-time validation
- ✅ Error messages per field
- ✅ Load branches dari API
- ✅ Select All / Deselect All branches
- ✅ Visual branch cards dengan icon
- ✅ Summary counter (X cabang dipilih)
- ✅ Loading states
- ✅ Success callback untuk refresh list

**Validation Rules**:
- Email: format valid
- Password: minimal 8 karakter
- Phone: format nomor telepon
- Branches: minimal 1 cabang harus dipilih

---

### 3. **Impersonate Button**
Komponen untuk melakukan impersonation dengan konfirmasi.

**File**: `apps/web/src/components/admin/ImpersonateButton.tsx`

**Features**:
- ✅ Button dengan icon UserCog
- ✅ Confirmation modal sebelum impersonate
- ✅ Warning message tentang audit trail
- ✅ Loading state saat proses
- ✅ Update auth store dengan token baru
- ✅ Update impersonation context
- ✅ Auto redirect ke dashboard yang sesuai
- ✅ Toast notification success/error

**Flow**:
1. User klik button "Impersonate"
2. Tampilkan confirmation modal
3. User konfirmasi
4. Call API `/admin/impersonate/:userId`
5. Terima token baru
6. Update auth store & context
7. Redirect ke dashboard Admin Manager

---

### 4. **API Client**
Client untuk komunikasi dengan backend API.

**File**: `apps/web/src/lib/api/adminManagersApi.ts`

**Endpoints**:
```typescript
// Get all admin managers (with filters)
GET /admin/managers?search=&isActive=&page=&limit=

// Create new admin manager
POST /admin/users/admin-manager
Body: {
  email, password, fullName, phoneNumber, branchIds[]
}

// Start impersonation
POST /admin/impersonate/:userId

// Stop impersonation
POST /admin/stop-impersonation

// Get branches for assignment
GET /admin/branches
```

---

## 🎨 UI/UX Design

### Color Scheme
- **Primary**: Blue gradient (#3b82f6 → #2563eb)
- **Impersonate**: Purple gradient (#8b5cf6 → #7c3aed)
- **Success**: Green (#10b981)
- **Warning**: Yellow (#fbbf24)
- **Danger**: Red (#ef4444)

### Components Style
- **Cards**: White background, rounded corners, subtle shadow on hover
- **Buttons**: Gradient backgrounds, smooth transitions
- **Modals**: Backdrop blur, centered, responsive
- **Tables**: Hover effects, clean borders
- **Badges**: Rounded, color-coded by status

### Responsive Design
- Grid layouts dengan `auto-fit` dan `minmax`
- Mobile-friendly modals
- Flexible table layouts
- Touch-friendly button sizes

---

## 🔐 Security & Permissions

### Authorization
- **Super Admin Only**: Hanya SUPER_ADMIN yang bisa akses fitur ini
- **Backend Validation**: Semua endpoint dilindungi dengan `authorize(['SUPER_ADMIN'])`
- **Token Validation**: JWT token divalidasi di setiap request

### Audit Trail
- Semua impersonation dicatat di audit log
- Action: `LOGIN` (proxy untuk IMPERSONATE_START)
- Meta data: target user, target role, nested status

### Data Validation
- **Frontend**: Real-time validation dengan error messages
- **Backend**: Schema validation dengan Zod
- **Sanitization**: Input di-sanitize sebelum disimpan

---

## 📊 Backend Integration

### Existing Endpoints (Already Implemented)
✅ `GET /admin/managers` - Get admin managers list  
✅ `POST /admin/users/admin-manager` - Create admin manager  
✅ `POST /admin/impersonate/:userId` - Start impersonation  
✅ `POST /admin/stop-impersonation` - Stop impersonation  
✅ `GET /admin/branches` - Get branches for assignment

### Database Schema
```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  role        Role
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  lastLoginAt DateTime?
  
  profile     Profile?
  managerBranches ManagerBranch[]
}

model ManagerBranch {
  id        String   @id @default(cuid())
  userId    String
  branchId  String
  createdAt DateTime @default(now())
  
  user      User     @relation(...)
  branch    Branch   @relation(...)
  
  @@unique([userId, branchId])
}
```

---

## 🧪 Testing Guide

### Manual Testing Steps

#### 1. View Admin Managers List
1. Login sebagai SUPER_ADMIN
2. Navigate ke `/admin/super-admin`
3. Klik tab "Admin Managers"
4. Verify: List tampil dengan data yang benar
5. Test search: ketik nama/email
6. Test filter: pilih Active/Inactive
7. Test pagination: klik Next/Previous

#### 2. Create Admin Manager
1. Klik button "Tambah Admin Manager"
2. Modal terbuka
3. Isi form:
   - Nama: "Test Manager"
   - Email: "test@example.com"
   - Phone: "+62 812 3456 7890"
   - Password: "password123"
   - Select 2-3 branches
4. Klik "Buat Admin Manager"
5. Verify: Success toast muncul
6. Verify: List refresh dengan data baru
7. Verify: Database memiliki user baru dengan role ADMIN_MANAGER
8. Verify: ManagerBranch records dibuat

#### 3. Impersonate Admin Manager
1. Dari list, klik button "Impersonate" pada salah satu manager
2. Confirmation modal muncul
3. Klik "Ya, Impersonate"
4. Verify: Success toast muncul
5. Verify: Redirect ke `/admin-manager`
6. Verify: Sidebar menampilkan impersonation banner
7. Verify: User dapat akses fitur Admin Manager
8. Verify: Audit log mencatat impersonation

#### 4. Stop Impersonation
1. Saat impersonating, klik "Stop Impersonation" di banner
2. Verify: Kembali ke akun SUPER_ADMIN
3. Verify: Redirect ke dashboard Super Admin
4. Verify: Audit log mencatat stop impersonation

### Edge Cases to Test
- [ ] Create dengan email yang sudah ada
- [ ] Create tanpa memilih branch
- [ ] Create dengan password < 8 karakter
- [ ] Impersonate user yang inactive
- [ ] Search dengan special characters
- [ ] Pagination dengan 0 results
- [ ] Network error handling

---

## 📁 File Structure

```
apps/web/src/
├── components/admin/
│   ├── AdminManagersTab.tsx              # Main component
│   ├── AdminManagersTab.module.css       # Styles
│   ├── CreateAdminManagerModal.tsx       # Create modal
│   ├── CreateAdminManagerModal.module.css
│   ├── ImpersonateButton.tsx             # Impersonate button
│   └── ImpersonateButton.module.css
├── lib/api/
│   └── adminManagersApi.ts               # API client
├── app/(staff)/admin/super-admin/
│   ├── page.tsx                          # Super admin page
│   └── page.module.css                   # Page styles
└── contexts/
    └── ImpersonationContext.tsx          # Impersonation state
```

---

## 🚀 Usage Example

### In Super Admin Page
```tsx
import { AdminManagersTab } from '@/components/admin/AdminManagersTab';

export default function SuperAdminPage() {
  return (
    <div>
      {/* ... other tabs ... */}
      
      {activeTab === 'admin-managers' && (
        <AdminManagersTab />
      )}
    </div>
  );
}
```

### Programmatic Impersonation
```typescript
import { adminManagersApi } from '@/lib/api/adminManagersApi';

const handleImpersonate = async (userId: string) => {
  try {
    const response = await adminManagersApi.startImpersonation(userId);
    // Update auth store
    setAccessToken(response.accessToken);
    // Redirect
    router.push('/admin-manager');
  } catch (error) {
    console.error(error);
  }
};
```

---

## 🔄 Future Enhancements

### Planned Features
- [ ] Edit Admin Manager (update info, reassign branches)
- [ ] Deactivate/Activate Admin Manager
- [ ] Bulk operations (activate/deactivate multiple)
- [ ] Export Admin Manager list to CSV
- [ ] Activity history per Admin Manager
- [ ] Branch performance metrics per Manager
- [ ] Email notification saat account dibuat
- [ ] Password reset functionality
- [ ] Two-factor authentication untuk Admin Manager

### Performance Optimizations
- [ ] Implement virtual scrolling untuk large lists
- [ ] Cache branches data
- [ ] Debounce search input
- [ ] Lazy load branch details

---

## 📝 Notes

### Important Considerations
1. **Password Security**: Password di-hash dengan bcrypt sebelum disimpan
2. **Token Expiry**: Impersonation token memiliki expiry yang sama dengan normal token
3. **Nested Impersonation**: Backend support nested impersonation (Super Admin → Admin Manager → Admin Cabang)
4. **Audit Trail**: Semua action tercatat dengan original user ID

### Known Limitations
1. Edit dan Deactivate button belum functional (UI only)
2. Bulk operations belum tersedia
3. Email notification belum diimplementasi

---

## ✅ Checklist

### Frontend
- [x] AdminManagersTab component
- [x] CreateAdminManagerModal component
- [x] ImpersonateButton component
- [x] API client (adminManagersApi)
- [x] CSS styling untuk semua components
- [x] Form validation
- [x] Error handling
- [x] Loading states
- [x] Success/error toasts
- [x] Responsive design

### Backend (Already Exists)
- [x] GET /admin/managers endpoint
- [x] POST /admin/users/admin-manager endpoint
- [x] POST /admin/impersonate/:userId endpoint
- [x] POST /admin/stop-impersonation endpoint
- [x] GET /admin/branches endpoint
- [x] Authorization middleware
- [x] Audit logging

### Integration
- [x] Connect frontend to backend APIs
- [x] Update auth store on impersonation
- [x] Update impersonation context
- [x] Handle redirects
- [x] Handle errors

---

## 🎉 Summary

Fitur Super Admin untuk mengelola Admin Manager telah selesai diimplementasikan dengan lengkap:

✅ **View**: List Admin Manager dengan search, filter, dan pagination  
✅ **Create**: Modal untuk membuat Admin Manager baru dengan branch assignment  
✅ **Impersonate**: Button untuk impersonate dengan confirmation modal  
✅ **UI/UX**: Design modern dengan gradient colors dan smooth animations  
✅ **Security**: Authorization, validation, dan audit trail  
✅ **Integration**: Fully integrated dengan backend APIs yang sudah ada

Fitur siap untuk testing dan deployment! 🚀
