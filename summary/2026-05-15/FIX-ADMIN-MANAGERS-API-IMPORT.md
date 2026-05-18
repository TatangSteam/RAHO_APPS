# Fix: Admin Managers API Import Error

**Tanggal**: 15 Mei 2026  
**Status**: ✅ Fixed

## 🐛 Error

```
Error loading admin managers: TypeError: Cannot read properties of undefined (reading 'get')
at Object.getAdminManagers (adminManagersApi.ts:65:32)
```

## 🔍 Root Cause

File `adminManagersApi.ts` menggunakan **default import** untuk `api`:
```typescript
import api from '../api';  // ❌ SALAH
```

Padahal di `api.ts`, `api` di-export sebagai **named export**:
```typescript
export const api: AxiosInstance = axios.create({...});  // Named export
```

## ✅ Solution

Ubah import di `adminManagersApi.ts` menjadi **named import**:

```typescript
import { api } from '../api';  // ✅ BENAR
```

## 📁 File yang Diubah

**File**: `apps/web/src/lib/api/adminManagersApi.ts`

**Before**:
```typescript
import api from '../api';
```

**After**:
```typescript
import { api } from '../api';
```

## 🧪 Testing

Setelah fix:
1. ✅ Refresh browser (Ctrl + Shift + R untuk hard refresh)
2. ✅ Navigate ke `/admin/managers`
3. ✅ API call ke `/admin/managers` berhasil
4. ✅ Data Admin Managers tampil di table
5. ✅ No more console errors

## 📝 Notes

- Error ini terjadi karena mismatch antara export type (named) dan import type (default)
- Browser mungkin perlu hard refresh untuk clear cache
- Pastikan dev server sudah restart jika perlu

## 🚀 Status

**FIXED** ✅ - Admin Managers page sekarang berfungsi dengan baik!
