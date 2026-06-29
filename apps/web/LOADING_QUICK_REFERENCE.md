# ⚡ Loading System - Quick Reference

## 🎯 TL;DR
Sistem loading lengkap dengan auto-tracking API, skeleton loaders, dan enhanced buttons untuk prevent double-click.

---

## 🚀 Quick Start

### 1. Button dengan Loading
```tsx
import { Button } from '@/components/ui/Button';

<Button 
  loading={isSubmitting} 
  loadingText="Menyimpan"
  variant="primary"
>
  Simpan
</Button>
```

### 2. Page dengan Skeleton
```tsx
import { SkeletonTable } from '@/components/ui/SkeletonLoader';

{loading ? <SkeletonTable rows={5} /> : <YourTable />}
```

### 3. Section Loading
```tsx
import { SectionLoadingOverlay } from '@/components/ui/SkeletonLoader';

<div className="relative">
  {content}
  {refreshing && <SectionLoadingOverlay />}
</div>
```

### 4. Manual Global Loading
```tsx
import { useLoading } from '@/contexts/LoadingContext';

const { showGlobalLoading, hideGlobalLoading } = useLoading();

showGlobalLoading('Processing...');
// ... do work
hideGlobalLoading();
```

---

## 📦 Available Components

### Buttons
```tsx
<Button variant="primary|secondary|danger|success|outline|ghost" />
<Button size="sm|md|lg" />
<Button loading={true} loadingText="Custom..." />
<Button icon={<Icon />} iconPosition="left|right" />
```

### Skeletons
```tsx
<Skeleton variant="text|circular|rectangular|rounded" />
<SkeletonCard />
<SkeletonTable rows={5} columns={4} />
<SkeletonList items={3} />
<SkeletonForm />
<SkeletonDashboard />
<SectionLoadingOverlay message="Loading..." />
```

### Global Loading
```tsx
const { 
  showGlobalLoading, 
  hideGlobalLoading,
  apiLoadingCount 
} = useLoading();
```

---

## ✅ Checklist Implementasi

### Untuk Setiap Halaman Baru:
- [ ] Ganti `<button>` dengan `<Button loading={...}>`
- [ ] Tambahkan skeleton loader saat loading
- [ ] Pastikan tombol disabled saat loading
- [ ] Gunakan try-finally untuk API calls
- [ ] Test double-click prevention

### Untuk Setiap Form:
- [ ] Gunakan `formState.isSubmitting` dari react-hook-form
- [ ] Button type="submit" dengan loading state
- [ ] Handle error dengan proper loading cleanup

### Untuk Setiap Tabel:
- [ ] Tampilkan `<SkeletonTable>` saat loading
- [ ] Gunakan `<SectionLoadingOverlay>` untuk refresh

---

## 🎨 Button Variants Preview

```tsx
// Primary (Amber)
<Button variant="primary">Primary</Button>

// Secondary (Gray)
<Button variant="secondary">Secondary</Button>

// Danger (Red)
<Button variant="danger">Delete</Button>

// Success (Green)
<Button variant="success">Approve</Button>

// Outline
<Button variant="outline">Outline</Button>

// Ghost
<Button variant="ghost">Ghost</Button>
```

---

## 🔥 Common Patterns

### Pattern: Form Submit
```tsx
const { formState: { isSubmitting } } = useForm();

<form onSubmit={handleSubmit(onSubmit)}>
  {/* fields */}
  <Button type="submit" loading={isSubmitting}>
    Submit
  </Button>
</form>
```

### Pattern: Delete Confirmation
```tsx
const [deleting, setDeleting] = useState(false);

<Button 
  variant="danger" 
  loading={deleting}
  onClick={handleDelete}
>
  Delete
</Button>
```

### Pattern: Refresh Data
```tsx
const [refreshing, setRefreshing] = useState(false);

<Button 
  variant="secondary"
  loading={refreshing}
  onClick={handleRefresh}
>
  Refresh
</Button>
```

---

## ⚠️ Important Rules

1. **Always disable button when loading**
   ```tsx
   <Button loading={loading} disabled={loading}>
   ```

2. **Always use try-finally**
   ```tsx
   try {
     await api.call();
   } finally {
     setLoading(false);
   }
   ```

3. **Use appropriate skeleton**
   - Table → `<SkeletonTable>`
   - List → `<SkeletonList>`
   - Card → `<SkeletonCard>`
   - Form → `<SkeletonForm>`

4. **Provide descriptive text**
   ```tsx
   // Good ✅
   <Button loadingText="Menyimpan data">
   
   // Bad ❌
   <Button loadingText="Loading">
   ```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Loading tidak berhenti | Gunakan try-finally block |
| Double-click masih terjadi | Set disabled={loading} |
| Overlay tidak muncul | Check LoadingProvider di layout |
| API loading tidak tracked | Jangan gunakan skipLoading |

---

## 📚 More Info
See `COMPREHENSIVE_LOADING_SYSTEM.md` for complete documentation.

---

**Quick Links:**
- Button Component: `components/ui/Button.tsx`
- Skeleton Loaders: `components/ui/SkeletonLoader.tsx`
- Loading Context: `contexts/LoadingContext.tsx`
- API Interceptors: `lib/api.ts`
