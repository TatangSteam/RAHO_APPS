# 🔧 Troubleshooting Guide - Loading System

## Common Errors & Solutions

### ❌ Error: "useLoading must be used within a LoadingProvider"

**Cause:** Hook atau component mencoba menggunakan `useLoading()` di luar `LoadingProvider`.

**Solution:**

#### ✅ Correct Structure:
```tsx
// layout.tsx
export default function Layout({ children }) {
  return (
    <LoadingProvider>
      <ComponentThatUsesLoading>
        {children}
      </ComponentThatUsesLoading>
    </LoadingProvider>
  );
}
```

#### ❌ Incorrect Structure:
```tsx
// layout.tsx
export default function Layout({ children }) {
  useApiLoading(); // ❌ Called before LoadingProvider!
  
  return (
    <LoadingProvider>
      {children}
    </LoadingProvider>
  );
}
```

**Fix:** Pisahkan component menjadi inner dan outer:
```tsx
// Inner component (uses LoadingContext)
function LayoutInner({ children }) {
  useApiLoading(); // ✅ Inside LoadingProvider
  return <div>{children}</div>;
}

// Outer component (provides LoadingContext)
export default function Layout({ children }) {
  return (
    <LoadingProvider>
      <LayoutInner>{children}</LayoutInner>
    </LoadingProvider>
  );
}
```

---

### ❌ Error: "Cannot find module 'clsx'" or "Cannot find module 'tailwind-merge'"

**Cause:** Dependencies belum terinstall.

**Solution:**
```bash
npm install clsx tailwind-merge
```

---

### ❌ Error: Button not showing loading state

**Cause:** 
1. `loading` prop tidak di-pass
2. State tidak berubah

**Solution:**
```tsx
// ❌ Bad
<Button onClick={handleSubmit}>Submit</Button>

// ✅ Good
const [loading, setLoading] = useState(false);

<Button loading={loading} onClick={handleSubmit}>
  Submit
</Button>
```

---

### ❌ Error: Double-click still happening

**Cause:** Button tidak disabled saat loading.

**Solution:**
```tsx
// The Button component already handles this internally
// Just pass the loading prop
<Button loading={isSubmitting}>
  Submit
</Button>

// If you have additional disable conditions:
<Button loading={isSubmitting} disabled={isSubmitting || otherCondition}>
  Submit
</Button>
```

---

### ❌ Error: Loading doesn't stop after API call

**Cause:** Missing try-finally block.

**Solution:**
```tsx
// ❌ Bad
const handleSubmit = async () => {
  setLoading(true);
  await api.post('/data'); // If this throws, loading stays true!
  setLoading(false);
};

// ✅ Good
const handleSubmit = async () => {
  try {
    setLoading(true);
    await api.post('/data');
  } finally {
    setLoading(false); // Always runs
  }
};
```

---

### ❌ Error: Global loading overlay not showing

**Cause:** 
1. `LoadingProvider` not in layout
2. `GlobalLoadingOverlay` not rendered
3. API calls using `skipLoading: true`

**Solution:**
```tsx
// Check layout structure
<LoadingProvider>
  <ApiLoadingSetup /> {/* Setup API integration */}
  <GlobalLoadingOverlay /> {/* Render overlay */}
  {/* Your app */}
</LoadingProvider>

// Check API call
const data = await api.get('/endpoint'); // ✅ Will show loading
const data = await api.get('/endpoint', { skipLoading: true }); // ❌ Won't show
```

---

### ❌ Error: Skeleton loader not showing

**Cause:** Conditional rendering logic error.

**Solution:**
```tsx
// ❌ Bad - shows nothing while loading
{!loading && <Content />}

// ✅ Good - shows skeleton while loading
{loading ? <SkeletonTable /> : <Content />}
```

---

### ❌ Error: TypeScript error on Button component

**Cause:** Missing types or incorrect import.

**Solution:**
```tsx
// ✅ Correct import
import { Button } from '@/components/ui/Button';

// If still error, check ButtonProps type
import { Button, type ButtonProps } from '@/components/ui/Button';
```

---

### ❌ Error: Tailwind classes not working on Button

**Cause:** Tailwind not configured properly or conflicting classes.

**Solution:**
```tsx
// Use className prop for additional styles
<Button className="mt-4 w-full">
  Submit
</Button>

// Check tailwind.config.ts includes all paths
content: [
  "./src/**/*.{js,ts,jsx,tsx,mdx}",
],
```

---

### ❌ Error: Loading animation not smooth

**Cause:** Missing custom animations in tailwind.config.

**Solution:**
Check `tailwind.config.ts` includes:
```typescript
theme: {
  extend: {
    animation: {
      'shimmer': 'shimmer 2s ease-in-out infinite',
      'spin-slow': 'spin 1.5s linear infinite',
    },
    keyframes: {
      shimmer: {
        '0%': { backgroundPosition: '-200% 0' },
        '100%': { backgroundPosition: '200% 0' },
      },
    },
  },
}
```

---

## Debugging Tips

### 1. Check Loading State
```tsx
import { useLoading } from '@/contexts/LoadingContext';

const { apiLoadingCount, isGlobalLoading } = useLoading();
console.log('Active API calls:', apiLoadingCount);
console.log('Global loading:', isGlobalLoading);
```

### 2. Check API Interceptor
```tsx
// In api.ts, add temporary logging
api.interceptors.request.use((config) => {
  console.log('API Request:', config.url);
  return config;
});

api.interceptors.response.use((response) => {
  console.log('API Response:', response.config.url);
  return response;
});
```

### 3. Check Button State
```tsx
<Button
  loading={loading}
  onClick={(e) => {
    console.log('Button clicked, loading:', loading);
    handleClick();
  }}
>
  Submit
</Button>
```

### 4. Check Skeleton Rendering
```tsx
console.log('Loading state:', loading);
return loading ? (
  <div>
    <p>Showing skeleton...</p>
    <SkeletonTable />
  </div>
) : (
  <div>
    <p>Showing content...</p>
    <Table />
  </div>
);
```

---

## Performance Issues

### Issue: Too many loading states

**Solution:** Use global API loading instead of individual states:
```tsx
// ❌ Bad - manual loading state
const [loading, setLoading] = useState(false);
const fetchData = async () => {
  setLoading(true);
  try {
    await api.get('/data');
  } finally {
    setLoading(false);
  }
};

// ✅ Good - auto-tracked by interceptor
const fetchData = async () => {
  await api.get('/data'); // Global loading overlay shows automatically
};
```

### Issue: Loading flicker on fast requests

**Solution:** Add minimum display time:
```tsx
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  const start = Date.now();
  
  try {
    await api.get('/data');
    
    // Show loading for minimum 300ms to avoid flicker
    const elapsed = Date.now() - start;
    if (elapsed < 300) {
      await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
    }
  } finally {
    setLoading(false);
  }
};
```

---

## Migration Issues

### Issue: Replacing all buttons

**Script to find all buttons:**
```bash
# Find all button elements in tsx files
grep -r "<button" src --include="*.tsx"
```

**Replace pattern:**
```tsx
// Before
<button
  disabled={loading}
  onClick={handleClick}
  className="bg-blue-500 text-white px-4 py-2 rounded"
>
  {loading ? 'Loading...' : 'Submit'}
</button>

// After
<Button
  loading={loading}
  loadingText="Menyimpan"
  variant="primary"
  onClick={handleClick}
>
  Submit
</Button>
```

---

## Testing

### Test Button Loading
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

test('button shows loading state', () => {
  const { rerender } = render(
    <Button loading={false}>Submit</Button>
  );
  
  expect(screen.getByText('Submit')).toBeInTheDocument();
  
  rerender(<Button loading={true}>Submit</Button>);
  
  expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  expect(screen.getByText(/memproses/i)).toBeInTheDocument();
});
```

### Test API Loading
```tsx
import { renderHook } from '@testing-library/react';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { useLoading } from '@/contexts/LoadingContext';

test('loading context increments on API start', () => {
  const wrapper = ({ children }) => <LoadingProvider>{children}</LoadingProvider>;
  
  const { result } = renderHook(() => useLoading(), { wrapper });
  
  expect(result.current.apiLoadingCount).toBe(0);
  
  result.current.incrementApiLoading();
  
  expect(result.current.apiLoadingCount).toBe(1);
});
```

---

## Quick Fixes

### Fix: Reset loading state
```tsx
// In browser console
sessionStorage.clear();
localStorage.clear();
location.reload();
```

### Fix: Clear stuck loading
```tsx
// Add to component for debugging
useEffect(() => {
  return () => {
    // Force clear loading on unmount
    hideGlobalLoading();
  };
}, []);
```

### Fix: Disable loading for specific request
```tsx
const data = await api.get('/polling-endpoint', { 
  skipLoading: true // Don't trigger global loading
});
```

---

## Support

**Documentation:**
- `COMPREHENSIVE_LOADING_SYSTEM.md` - Full documentation
- `LOADING_QUICK_REFERENCE.md` - Quick reference
- `EXAMPLE_IMPLEMENTATION.md` - Code examples

**Component Locations:**
- Button: `components/ui/Button.tsx`
- Skeletons: `components/ui/SkeletonLoader.tsx`
- Context: `contexts/LoadingContext.tsx`
- API Setup: `lib/api.ts`

**Common Paths:**
```
src/
├── contexts/LoadingContext.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── SkeletonLoader.tsx
│   │   └── GlobalLoadingOverlay.tsx
│   └── providers/
│       └── ApiLoadingSetup.tsx
├── hooks/
│   └── useApiLoading.ts
└── lib/
    ├── api.ts
    └── utils.ts
```

---

**Last Updated:** 29 Juni 2026  
**Version:** 1.0.1  
**Status:** Production Ready ✅
