# 📝 Example Implementation - Loading System

## Contoh Implementasi Lengkap

### 1. Halaman dengan Form Submit

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { SkeletonForm } from '@/components/ui/SkeletonLoader';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';

export default function FormPage() {
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm();

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/data');
      setInitialData(response.data);
    } catch (error) {
      showToast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      // API call with auto-loading tracking
      await api.post('/submit', data);
      showToast.success('Data berhasil disimpan');
    } catch (error) {
      showToast.error('Gagal menyimpan data');
    }
  };

  // Show skeleton while loading initial data
  if (loading) {
    return <SkeletonForm />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Form Example</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label>Name</label>
          <input {...register('name', { required: true })} />
          {errors.name && <span>This field is required</span>}
        </div>

        <div>
          <label>Email</label>
          <input {...register('email', { required: true })} />
          {errors.email && <span>This field is required</span>}
        </div>

        {/* Submit Button with Loading */}
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            loadingText="Menyimpan"
            icon={<Save />}
          >
            Simpan
          </Button>
          
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
          >
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---

### 2. Halaman dengan Tabel dan Actions

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { SkeletonTable, SectionLoadingOverlay } from '@/components/ui/SkeletonLoader';
import { api } from '@/lib/api';
import { Trash2, Edit, RefreshCw } from 'lucide-react';

export default function TablePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/items');
      setItems(response.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchItems();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    
    try {
      setDeletingId(id);
      await api.delete(`/items/${id}`);
      setItems(items.filter(item => item.id !== id));
      showToast.success('Item deleted');
    } catch (error) {
      showToast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  // Show skeleton while initial loading
  if (loading) {
    return <SkeletonTable rows={10} columns={4} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Items</h1>
        
        <Button
          variant="secondary"
          icon={<RefreshCw />}
          loading={refreshing}
          loadingText="Memuat ulang"
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </div>

      {/* Table with overlay loading for refresh */}
      <div className="relative">
        <table className="w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.status}</td>
                <td className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Edit />}
                    onClick={() => router.push(`/items/${item.id}`)}
                  >
                    Edit
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 />}
                    loading={deletingId === item.id}
                    loadingText="Menghapus"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Section Loading Overlay */}
        {refreshing && <SectionLoadingOverlay message="Memuat ulang data..." />}
      </div>
    </div>
  );
}
```

---

### 3. Modal dengan Form

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onSave: (data: any) => Promise<void>;
}

export function EditModal({ isOpen, onClose, item, onSave }: EditModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: item
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Edit Item</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSave)}>
          <div className="space-y-4 mb-6">
            <div>
              <label>Name</label>
              <input {...register('name', { required: true })} />
            </div>
            
            <div>
              <label>Description</label>
              <textarea {...register('description')} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              loadingText="Menyimpan"
            >
              Simpan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### 4. Filter/Search dengan Loading

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { SectionLoadingOverlay } from '@/components/ui/SkeletonLoader';
import { Search, Filter } from 'lucide-react';

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        handleSearch();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, filter]);

  const handleSearch = async () => {
    try {
      setSearching(true);
      const response = await api.get('/search', {
        params: { q: searchTerm, filter },
        skipLoading: true  // Don't show global loading for search
      });
      setResults(response.data);
    } finally {
      setSearching(false);
    }
  };

  const handleFilterChange = async (newFilter: string) => {
    setFilter(newFilter);
    // Will trigger search via useEffect
  };

  return (
    <div>
      {/* Search Bar */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border"
          />
        </div>

        <Button
          variant="secondary"
          icon={<Filter />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
        </Button>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          size="sm"
          variant={filter === 'all' ? 'primary' : 'secondary'}
          onClick={() => handleFilterChange('all')}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={filter === 'active' ? 'primary' : 'secondary'}
          onClick={() => handleFilterChange('active')}
        >
          Active
        </Button>
        <Button
          size="sm"
          variant={filter === 'archived' ? 'primary' : 'secondary'}
          onClick={() => handleFilterChange('archived')}
        >
          Archived
        </Button>
      </div>

      {/* Results with Loading Overlay */}
      <div className="relative">
        {results.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            No results found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result) => (
              <div key={result.id} className="p-4 border rounded-xl">
                {result.name}
              </div>
            ))}
          </div>
        )}

        {searching && <SectionLoadingOverlay message="Mencari..." />}
      </div>
    </div>
  );
}
```

---

### 5. Multi-Step Process dengan Manual Loading

```tsx
'use client';

import { useState } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { Button } from '@/components/ui/Button';

export default function MultiStepProcess() {
  const { showGlobalLoading, hideGlobalLoading } = useLoading();
  const [step, setStep] = useState(1);

  const handleProcess = async () => {
    try {
      // Step 1: Validate
      showGlobalLoading('Memvalidasi data...');
      await api.post('/validate');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Process
      showGlobalLoading('Memproses data...');
      await api.post('/process');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Generate
      showGlobalLoading('Menghasilkan laporan...');
      await api.post('/generate');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Save
      showGlobalLoading('Menyimpan hasil...');
      await api.post('/save');
      
      showToast.success('Proses selesai!');
    } catch (error) {
      showToast.error('Proses gagal');
    } finally {
      hideGlobalLoading();
    }
  };

  return (
    <div>
      <h1>Multi-Step Process</h1>
      
      <Button
        variant="primary"
        onClick={handleProcess}
      >
        Start Process
      </Button>
    </div>
  );
}
```

---

### 6. Dashboard dengan Multiple Loading States

```tsx
'use client';

import { useState, useEffect } from 'react';
import { SkeletonDashboard } from '@/components/ui/SkeletonLoader';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard');
      setStats(response.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchDashboard();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw />}
          loading={refreshing}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </div>

      {/* Dashboard content */}
      <div className="grid grid-cols-4 gap-4">
        {/* Stats cards */}
      </div>
    </div>
  );
}
```

---

## Best Practices Summary

### ✅ DO:
- Use `Button` component for all buttons
- Use appropriate skeleton for each content type
- Provide descriptive loading text
- Use try-finally blocks
- Disable buttons when loading
- Skip loading for background/polling requests

### ❌ DON'T:
- Use native `<button>` elements
- Show "Loading..." without context
- Forget to handle errors
- Leave loading state active on error
- Track loading for every poll request

---

**Catatan:** Semua contoh di atas menggunakan komponen dan pattern yang sudah tersedia. Copy-paste dan sesuaikan dengan kebutuhan Anda!
