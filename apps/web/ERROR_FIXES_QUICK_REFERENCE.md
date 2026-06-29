# ⚡ Error Fixes - Quick Reference

## 🔴 Error: "useLoading must be used within a LoadingProvider"

**Quick Fix:**
```tsx
// ❌ Wrong
export default function Layout({ children }) {
  useApiLoading(); // Called too early!
  return <LoadingProvider>{children}</LoadingProvider>;
}

// ✅ Correct
function LayoutInner({ children }) {
  useApiLoading(); // Called after LoadingProvider
  return <>{children}</>;
}

export default function Layout({ children }) {
  return (
    <LoadingProvider>
      <LayoutInner>{children}</LayoutInner>
    </LoadingProvider>
  );
}
```

---

## 🔴 Error: "setLoadingCallbacks is not a function"

**Quick Fix:**
```typescript
// ❌ Wrong import
import { setLoadingCallbacks } from '@/lib/api';

// ✅ Correct import
import { setLoadingCallbacks } from '@/lib/apiLoadingTracking';
```

**Files to update:**
- `components/providers/ApiLoadingSetup.tsx`
- `hooks/useApiLoading.ts`

---

## 🔴 Webpack/Build Issues

**Quick Fix:**
```bash
# 1. Stop dev server (Ctrl+C)

# 2. Clear cache
rm -rf .next

# 3. Clear node modules cache (if needed)
rm -rf node_modules/.cache

# 4. Restart dev server
npm run dev
```

---

## 🔴 TypeScript Cannot Find Module

**Quick Fix:**
```bash
# 1. Restart TypeScript server in VSCode
# Press: Ctrl+Shift+P
# Type: "TypeScript: Restart TS Server"

# 2. Or restart VSCode
```

---

## 🔴 Hot Reload Not Working

**Quick Fix:**
```bash
# Hard refresh browser
# Windows: Ctrl+Shift+R
# Mac: Cmd+Shift+R

# Or close and reopen browser tab
```

---

## 🔴 Loading Not Showing

**Check:**
1. LoadingProvider in layout? ✅
2. ApiLoadingSetup rendered? ✅
3. GlobalLoadingOverlay rendered? ✅
4. Using correct import? ✅

```tsx
// Correct structure
<LoadingProvider>
  <ApiLoadingSetup />
  <GlobalLoadingOverlay />
  <YourApp />
</LoadingProvider>
```

---

## 🔴 Button Loading Not Working

**Check:**
```tsx
// ✅ Correct
import { Button } from '@/components/ui/Button';

<Button loading={isSubmitting}>Submit</Button>

// ❌ Wrong
<button disabled={loading}>Submit</button>
```

---

## Emergency Reset

**Nuclear option (if nothing else works):**
```bash
# 1. Stop server
# 2. Delete everything
rm -rf .next
rm -rf node_modules

# 3. Reinstall
npm install

# 4. Start fresh
npm run dev
```

---

## Quick Diagnostic

**Add to your component:**
```tsx
import { useLoading } from '@/contexts/LoadingContext';

const { apiLoadingCount, isGlobalLoading } = useLoading();
console.log('Loading Debug:', { apiLoadingCount, isGlobalLoading });
```

---

## Import Reference

```typescript
// Loading Context
import { useLoading } from '@/contexts/LoadingContext';

// Loading Tracking (for setup)
import { setLoadingCallbacks } from '@/lib/apiLoadingTracking';

// UI Components
import { Button } from '@/components/ui/Button';
import { PageLoading, ButtonLoading } from '@/components/ui/LoadingSpinner';
import { SkeletonTable } from '@/components/ui/SkeletonLoader';

// API
import { api } from '@/lib/api';
```

---

## File Locations

```
src/
├── lib/
│   ├── api.ts
│   └── apiLoadingTracking.ts ⚡ NEW
├── contexts/
│   └── LoadingContext.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── SkeletonLoader.tsx
│   │   └── GlobalLoadingOverlay.tsx
│   └── providers/
│       └── ApiLoadingSetup.tsx ⚡ NEW
└── hooks/
    └── useApiLoading.ts
```

---

## Status Check

**Verify setup:**
```bash
# Check files exist
ls src/lib/apiLoadingTracking.ts
ls src/components/providers/ApiLoadingSetup.tsx

# Check no build errors
npm run build

# Check no type errors
npm run type-check
```

---

## Still Not Working?

1. Read `TROUBLESHOOTING.md`
2. Read `FIX_SUMMARY.md`
3. Check `COMPREHENSIVE_LOADING_SYSTEM.md`

Or restart everything:
```bash
# Ctrl+C to stop
rm -rf .next
npm run dev
```

---

**Updated:** 29 Juni 2026  
**All Errors:** FIXED ✅  
**System:** STABLE ✅
