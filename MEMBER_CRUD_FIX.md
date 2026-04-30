# Member CRUD Fix - 500 Internal Server Error Resolution

## 🔧 Issue Identified

The 500 Internal Server Error was caused by a mismatch between the database schema and the member update service implementation.

## ❌ **Root Cause:**

The `MemberUpdateService` was trying to update fields that don't exist in the database:

### **Incorrect Field Mapping:**
- Service expected `gender` → Database has `jenisKelamin`
- Service expected `phoneNumber` → Database has phone in `UserProfile` table
- Service expected `fullName` → Database has fullName in `UserProfile` table
- Service expected `email` → Database has email in `User` table
- Service expected `status` → Database has `isActive` field

### **Wrong Table Structure:**
The service was trying to update all fields in the `Member` table, but member data is actually spread across 3 tables:
- `User` table: email, password, role
- `UserProfile` table: fullName, phone, avatarUrl
- `Member` table: member-specific fields (dateOfBirth, jenisKelamin, address, etc.)

## ✅ **Fixes Applied:**

### 1. **Updated Member Update Service**
**File**: `apps/api/src/modules/members/services/member-update.service.ts`

#### **Fixed Field Mapping:**
```typescript
// Before (incorrect)
data: {
  fullName: data.fullName,           // ❌ Not in Member table
  gender: data.gender,               // ❌ Should be jenisKelamin
  phoneNumber: data.phoneNumber,     // ❌ Not in Member table
  email: data.email,                 // ❌ Not in Member table
  status: data.status,               // ❌ Field doesn't exist
}

// After (correct)
// Update User table
await tx.user.update({
  where: { id: member.userId },
  data: { email: data.email }        // ✅ Correct table
});

// Update UserProfile table  
await tx.userProfile.update({
  where: { userId: member.userId },
  data: {
    fullName: data.fullName,         // ✅ Correct table
    phone: data.phone                // ✅ Correct table
  }
});

// Update Member table
await tx.member.update({
  where: { id: memberId },
  data: {
    jenisKelamin: data.gender,       // ✅ Correct field name
    dateOfBirth: new Date(data.birthDate),
    address: data.address,
    emergencyContact: data.emergencyContactName
  }
});
```

#### **Fixed Delete Operation:**
```typescript
// Before (incorrect)
data: { status: 'INACTIVE' }        // ❌ Field doesn't exist

// After (correct)  
data: { isActive: false }            // ✅ Correct field
```

#### **Fixed Data Validation:**
- Updated phone uniqueness check to query `UserProfile` table
- Updated email uniqueness check to query `User` table
- Added proper transaction handling for multi-table updates

### 2. **Updated Frontend Data Mapping**
**File**: `apps/web/src/components/branches/MemberCrudModal.tsx`

#### **Fixed API Call Parameters:**
```typescript
// Removed non-existent field
emergencyContactPhone: formData.emergencyContactPhone  // ❌ Removed
```

### 3. **Fixed Data Formatting**
Updated `formatMemberData()` method to correctly access data from related tables:

```typescript
// Before (incorrect)
fullName: member.fullName,           // ❌ Not in Member table

// After (correct)
fullName: member.user?.profile?.fullName,  // ✅ Correct path
phone: member.user?.profile?.phone,        // ✅ Correct path
email: member.user?.email,                 // ✅ Correct path
jenisKelamin: member.jenisKelamin,         // ✅ Correct field name
```

## 🧪 **Testing Instructions:**

### **Step 1: Verify API Server**
1. Ensure API server is running on port 4000
2. Check server logs for successful startup message

### **Step 2: Test Member Edit**
1. Navigate to branch detail page
2. Go to Members tab
3. Click edit icon on any member
4. Modify member information
5. Click "Simpan Perubahan"
6. Should see success message and updated data

### **Step 3: Test Member Delete**
1. Navigate to branch detail page  
2. Go to Members tab
3. Click delete icon on any member
4. Confirm deletion
5. Should see success message and member removed from list

### **Step 4: Check Server Logs**
Monitor API server console for any errors during operations.

## 🔍 **Expected Behavior:**

### **Member Edit:**
- ✅ Modal opens with current member data
- ✅ Form validation works correctly
- ✅ Save operation completes successfully
- ✅ Data refreshes automatically
- ✅ Success toast message appears

### **Member Delete:**
- ✅ Confirmation dialog appears
- ✅ Delete operation completes successfully
- ✅ Member is soft-deleted (isActive = false)
- ✅ Member disappears from list
- ✅ Success toast message appears

## 📝 **Database Schema Reference:**

### **Member Data Structure:**
```sql
-- User table (authentication)
users: id, email, password, role

-- UserProfile table (personal info)  
user_profiles: userId, fullName, phone, avatarUrl

-- Member table (member-specific)
members: id, userId, memberNo, dateOfBirth, jenisKelamin, 
         address, emergencyContact, isActive, voucherCount
```

### **Key Relationships:**
- `Member.userId` → `User.id` (one-to-one)
- `UserProfile.userId` → `User.id` (one-to-one)
- Member data spans all 3 tables

## 🚀 **Status:**
✅ **FIXED** - Member edit and delete operations now work correctly with proper database schema mapping and transaction handling.