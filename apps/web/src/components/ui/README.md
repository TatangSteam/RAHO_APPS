# UI Components - Loading Spinner

## Quick Start Guide

### Import
```tsx
import { PageLoading, ButtonLoading, LoadingSpinner } from '@/components/ui/LoadingSpinner';
```

---

## Components

### 1. PageLoading (Recommended)
Use this for page-level loading states.

```tsx
{loading ? (
  <PageLoading text="Memuat data inventori" />
) : (
  // Your content
)}
```

### 2. ButtonLoading
Use this for submit buttons and action buttons.

```tsx
<button disabled={isSubmitting}>
  {isSubmitting ? (
    <ButtonLoading text="Menyimpan" />
  ) : (
    <>
      <Save /> Simpan
    </>
  )}
</button>
```

### 3. LoadingSpinner (Custom)
Use this when you need custom loading UI.

```tsx
<LoadingSpinner 
  size="lg" 
  text="Custom loading text" 
  variant="amber" 
  fullPage={false}
/>
```

---

## Props

### PageLoading
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| text | string | "Memuat data" | Loading text to display |

### ButtonLoading
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| text | string | "Memproses" | Button loading text |
| size | 'sm' \| 'md' | 'md' | Spinner size |

### LoadingSpinner
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| size | 'sm' \| 'md' \| 'lg' \| 'xl' | 'md' | Spinner size |
| text | string | undefined | Optional text below spinner |
| fullPage | boolean | false | Show as full page overlay |
| variant | 'default' \| 'primary' \| 'amber' \| 'blue' \| 'green' | 'primary' | Color variant |

---

## Examples

### Example 1: Simple Page Loading
```tsx
export default function MyPage() {
  const [loading, setLoading] = useState(true);

  if (loading) return <PageLoading text="Memuat data..." />;

  return <div>{/* content */}</div>;
}
```

### Example 2: Form with Button Loading
```tsx
export default function MyForm() {
  const { formState: { isSubmitting } } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <ButtonLoading text="Menyimpan" />
        ) : (
          'Simpan'
        )}
      </button>
    </form>
  );
}
```

### Example 3: Full Page Overlay (Login)
```tsx
export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <LoadingSpinner size="xl" text="Memproses Login" variant="amber" />
        </div>
      )}
      
      <form>{/* login form */}</form>
    </>
  );
}
```

---

## Features

✅ Dual-ring spinner animation  
✅ Animated dots (bounce effect)  
✅ Ping effect for depth  
✅ Dark mode support  
✅ Responsive design  
✅ Multiple color variants  
✅ GPU-accelerated animations  

---

## Tips

1. Always provide descriptive text: "Memuat data inventori" > "Loading..."
2. Disable forms/buttons during loading to prevent double submission
3. Use PageLoading for consistent styling across pages
4. Use ButtonLoading inside buttons for better UX
5. Match variant color with your action (amber for primary, blue for secondary, etc.)

---

**Need help?** Check `LOADING_SPINNER_IMPLEMENTATION.md` for detailed documentation.
