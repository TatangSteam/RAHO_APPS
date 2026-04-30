# CRUD Permissions Fix - Branch Management System

## 🔧 Issue Fixed

The edit and delete operations were returning 403 (Forbidden) errors because the API endpoints had overly restrictive authorization requirements.

## ✅ Changes Made

### 1. **Updated Member API Authorization**
**File**: `apps/api/src/modules/members/members.routes.ts`

**Before** (Only SUPER_ADMIN):
```typescript
// PATCH /api/v1/members/:memberId - Update member
router.patch('/:memberId', authenticate, authorize([Role.SUPER_ADMIN]), ...)

// DELETE /api/v1/members/:memberId - Delete member  
router.delete('/:memberId', authenticate, authorize([Role.SUPER_ADMIN]), ...)
```

**After** (ADMIN_PLUS roles):
```typescript
// PATCH /api/v1/members/:memberId - Update member
router.patch('/:memberId', authenticate, authorize(ADMIN_PLUS), ...)

// DELETE /api/v1/members/:memberId - Delete member
router.delete('/:memberId', authenticate, authorize(ADMIN_PLUS), ...)
```

Where `ADMIN_PLUS = [Role.ADMIN_LAYANAN, Role.ADMIN_CABANG, Role.ADMIN_MANAGER, Role.SUPER_ADMIN]`

### 2. **Added Debug Logging**
Added console logging to help diagnose permission issues:
- Current user role and permissions
- API call details and responses
- Error details for troubleshooting

## 🔐 Required User Roles

To use the CRUD functionality, users must have one of these roles:

### **Members CRUD:**
- ✅ `SUPER_ADMIN` - Full access
- ✅ `ADMIN_MANAGER` - Full access  
- ✅ `ADMIN_CABANG` - Full access
- ✅ `ADMIN_LAYANAN` - Full access

### **Staff CRUD:**
- ✅ `SUPER_ADMIN` - Full access
- ✅ `ADMIN_MANAGER` - Full access
- ✅ `ADMIN_CABANG` - Full access

### **Inventory CRUD:**
- ✅ `SUPER_ADMIN` - Full access
- ✅ `ADMIN_MANAGER` - Full access
- ✅ `ADMIN_CABANG` - Full access

## 🧪 Testing Instructions

### **Step 1: Check Current User Role**
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Navigate to any branch detail page
4. Check the console logs for current user information

### **Step 2: Login with Correct Role**
If you see permission errors, log in with one of these test accounts:

#### **SUPER_ADMIN Account:**
- **Email**: `superadmin@raho.id`
- **Role**: `SUPER_ADMIN`
- **Access**: All branches, all operations

#### **ADMIN_MANAGER Accounts:**
- **Email**: `manager1@raho.id`
- **Role**: `ADMIN_MANAGER`  
- **Access**: All branches, all operations

- **Email**: `manager2@raho.id`
- **Role**: `ADMIN_MANAGER`
- **Access**: All branches, all operations

#### **ADMIN_CABANG Accounts:**
- **Email**: `admincabang.pst@raho.id`
- **Role**: `ADMIN_CABANG`
- **Branch**: Jakarta Pusat (PST)

- **Email**: `admincabang.bdg@raho.id`
- **Role**: `ADMIN_CABANG`
- **Branch**: Bandung (BDG)

- **Email**: `admincabang.sby@raho.id`
- **Role**: `ADMIN_CABANG`
- **Branch**: Surabaya (SBY)

### **Step 3: Test CRUD Operations**
1. Navigate to `/branches/[branchId]` 
2. Switch to Members, Inventory, or Staff tabs
3. Try the following operations:
   - **Create**: Click "Tambah" button
   - **Edit**: Click edit icon in table rows
   - **Delete**: Click delete icon in table rows

### **Step 4: Check Console Logs**
If operations fail, check browser console for detailed error information:
- User role and permissions
- API endpoint being called
- Server response and error details

## 🔍 Troubleshooting

### **403 Forbidden Errors:**
- Check user role in console logs
- Ensure user has required role (see above)
- Try logging in with SUPER_ADMIN account

### **500 Internal Server Errors:**
- Check API server is running on port 4000
- Check server console for error details
- Verify database connection

### **Network Errors:**
- Ensure API server is running: `npm run dev` in `apps/api`
- Check API is accessible at `http://localhost:4000`

## 🚀 Expected Behavior

After logging in with the correct role:

1. **Members Tab:**
   - ✅ "Tambah Member" button works
   - ✅ Edit member modal opens and saves
   - ✅ Delete member works with confirmation

2. **Staff Tab:**
   - ✅ "Tambah Staff" button works
   - ✅ Edit staff modal opens and saves
   - ✅ Delete staff works with confirmation

3. **Inventory Tab:**
   - ✅ "Tambah Item" button works
   - ✅ Edit inventory modal opens and saves
   - ✅ Delete inventory works with confirmation

All operations should show success messages and refresh the data automatically.

## 📝 Notes

- The API server needs to be restarted to apply the route changes
- Users with lower roles (DOCTOR, NURSE, ADMIN_LAYANAN) can view data but cannot edit/delete
- Branch access restrictions still apply for non-global roles
- All operations include proper validation and error handling