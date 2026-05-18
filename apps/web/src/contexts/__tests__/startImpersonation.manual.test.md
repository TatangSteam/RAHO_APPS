# Manual Test: startImpersonation Function

## Test Scenario 1: Super Admin → Admin Manager

### Setup
1. Login as Super Admin (superadmin@raho.id)
2. Navigate to `/admin/super-admin`
3. Go to "Admin Managers" tab

### Test Steps
1. Click "Masuk Sebagai" button on an Admin Manager row
2. Verify:
   - API call to `POST /api/v1/admin/impersonate/:userId` with `targetRole: 'ADMIN_MANAGER'`
   - Token is updated in auth store
   - State is updated:
     - `isImpersonating: true`
     - `originalUser` is set to Super Admin
     - `impersonatedUser` is set to Admin Manager
     - `impersonationChain` has 2 items
   - Redirected to `/admin-manager`
   - Banner shows "Anda sedang masuk sebagai [Admin Manager Name]"
   - Sidebar shows Admin Manager menus

## Test Scenario 2: Admin Manager → Admin Cabang

### Setup
1. Login as Admin Manager OR continue from Scenario 1 (already impersonating)
2. Navigate to `/admin-manager`
3. Go to "Admin Cabang" tab

### Test Steps
1. Click "Masuk Sebagai" button on an Admin Cabang row
2. Verify:
   - API call to `POST /api/v1/admin/impersonate/:userId` with `targetRole: 'ADMIN_CABANG'`
   - Token is updated in auth store
   - State is updated:
     - `isImpersonating: true`
     - `impersonationChain` has 3 items (if nested) or 2 items (if direct)
     - `impersonatedUser` is set to Admin Cabang
   - Redirected to `/dashboard`
   - Banner shows impersonation chain
   - Sidebar shows Admin Cabang menus

## Test Scenario 3: Error Handling

### Test Steps
1. Try to impersonate an inactive user
2. Verify:
   - Error message is displayed
   - State shows error
   - Loading state is set to false
   - No redirect occurs

## Implementation Verification

### Function Signature ✅
```typescript
startImpersonation: (userId: string, targetRole: 'ADMIN_MANAGER' | 'ADMIN_CABANG') => Promise<void>
```

### API Call ✅
```typescript
const response = await adminManagersApi.impersonateUser(userId, targetRole);
```

### Token Update ✅
```typescript
const { refreshToken } = useAuthStore.getState();
setAccessToken(token, refreshToken || '');
```

### State Update ✅
```typescript
setState({
  isImpersonating: true,
  originalUser: currentUser,
  impersonatedUser: {
    id: impersonatedUser.id,
    email: impersonatedUser.email,
    fullName: impersonatedUser.fullName,
    role: impersonatedUser.role,
    branchId: impersonatedUser.branchId,
    branches: impersonatedUser.branches,
  },
  impersonationChain: chain,
  loading: false,
  error: null,
});
```

### Redirect Logic ✅
```typescript
if (targetRole === 'ADMIN_MANAGER') {
  router.push('/admin-manager');
} else if (targetRole === 'ADMIN_CABANG') {
  router.push('/dashboard');
}
```

### Error Handling ✅
```typescript
catch (error: any) {
  const errorMessage = error.response?.data?.error?.message || 'Gagal memulai impersonation';
  setState(prev => ({
    ...prev,
    loading: false,
    error: errorMessage,
  }));
  throw error;
}
```

## Conclusion

The `startImpersonation` function is **FULLY IMPLEMENTED** and meets all requirements:

1. ✅ Correct function signature
2. ✅ Calls API to start impersonation
3. ✅ Updates token in auth store
4. ✅ Updates impersonation state correctly
5. ✅ Redirects to appropriate dashboard based on target role
6. ✅ Handles errors gracefully
7. ✅ Supports both ADMIN_MANAGER and ADMIN_CABANG target roles
8. ✅ Supports nested impersonation (Super Admin → Admin Manager → Admin Cabang)
9. ✅ Parses token to extract impersonation chain
10. ✅ Maintains loading and error states

The implementation is complete and ready for use.
