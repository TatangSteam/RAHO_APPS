'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import styles from '../operations.module.css';

type Tab = 'WAREHOUSE' | 'UOM' | 'PRODUCT' | 'BATCH';
type Row = Record<string, any>;

export default function InventoryMasterDataPage() {
  const { user, activeBranchId } = useAuthStore();
  const [tab, setTab] = useState<Tab>('WAREHOUSE');
  const [branches, setBranches] = useState<Row[]>([]);
  const [branchId, setBranchId] = useState(activeBranchId || user?.branchId || '');
  const [warehouses, setWarehouses] = useState<Row[]>([]);
  const [uoms, setUoms] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [batches, setBatches] = useState<Row[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warehouseForm, setWarehouseForm] = useState({ code: '', name: '', isDefault: false });
  const [locationForm, setLocationForm] = useState({ warehouseId: '', code: '', name: '' });
  const [uomForm, setUomForm] = useState({ code: '', name: '', category: 'GENERAL', precision: 4 });
  const [productForm, setProductForm] = useState({ sku: '', name: '', category: 'CONSUMABLE', baseUomId: '', usageUomId: '', conversionFactor: '1', tracksBatch: false, tracksExpiry: false });
  const [batchForm, setBatchForm] = useState({ masterProductId: '', batchNumber: '', manufactureDate: '', expiryDate: '' });
  const [conversionForm, setConversionForm] = useState({ productId: '', baseUomId: '', usageUomId: '', factor: '1' });
  const [previewForm, setPreviewForm] = useState({ quantity: '', factor: '1', direction: 'BASE_TO_USAGE' as 'BASE_TO_USAGE' | 'USAGE_TO_BASE' });
  const [previewResult, setPreviewResult] = useState('');

  const canManage = permissions.has('INVENTORY.MASTER.MANAGE');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const accessResponse = await api.get('/iam/me');
      const effectivePermissions = new Set<string>(accessResponse.data.data?.permissions || []);
      setPermissions(effectivePermissions);

      const uomResponse = await inventoryApi.getUoms();
      setUoms(uomResponse.data?.data || []);
      const productResponse = await inventoryApi.getMasterProducts();
      setProducts(productResponse.data?.data?.products || []);

      if (!effectivePermissions.has('INVENTORY.MASTER.MANAGE')) {
        setTab('UOM');
        setBranches([]);
        setWarehouses([]);
        setBatches([]);
        return;
      }

      const [branchResponse, warehouseResponse, batchResponse] = await Promise.all([
        api.get('/branches', { params: { isActive: true, limit: 100 } }),
        inventoryApi.getWarehouses(branchId ? { branchId } : undefined),
        inventoryApi.getBatches(),
      ]);
      const branchRows = branchResponse.data?.data || [];
      setBranches(branchRows);
      if (!branchId && branchRows[0]?.id) setBranchId(branchRows[0].id);
      setWarehouses(warehouseResponse.data?.data || []);
      setBatches(batchResponse.data?.data || []);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'Gagal memuat master inventory.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent, operation: () => Promise<unknown>, reset: () => void) => {
    event.preventDefault();
    try {
      setSaving(true);
      await operation();
      reset();
      showToast.success('Master data berhasil disimpan.');
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Master data gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const createDefaultStorage = async () => {
    if (!branchId) return;
    try {
      setSaving(true);
      await inventoryApi.createWarehouse({
        branchId,
        code: 'DEFAULT',
        name: 'Warehouse Utama',
        isDefault: true,
      });
      showToast.success('Warehouse dan lokasi utama berhasil disiapkan.');
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Gagal menyiapkan warehouse utama.');
    } finally {
      setSaving(false);
    }
  };

  const activeProducts = useMemo(() => products.filter((product) => product.isActive), [products]);
  const selectedConversionProduct = useMemo(
    () => products.find((product) => product.id === conversionForm.productId),
    [conversionForm.productId, products],
  );

  const selectConversionProduct = (productId: string) => {
    const product = products.find((row) => row.id === productId);
    const factor = product ? String(product.conversionFactor) : '1';
    setConversionForm({
      productId,
      baseUomId: product?.baseUomId || '',
      usageUomId: product?.usageUomId || '',
      factor,
    });
    setPreviewForm((current) => ({ ...current, factor }));
    setPreviewResult('');
  };

  const previewConversion = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      const response = await inventoryApi.previewConversion(previewForm);
      setPreviewResult(response.data?.data?.result || '');
    } catch (requestError: any) {
      setPreviewResult('');
      showToast.error(requestError.response?.data?.error?.message || 'Preview konversi gagal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><h1>Master Inventori</h1><p>Warehouse, lokasi, satuan, produk, konversi, dan batch.</p></div>
        <button className={styles.secondaryButton} onClick={() => void load()} title="Muat ulang"><RefreshCw size={16} /></button>
      </header>

      {canManage && <div className={styles.toolbar}>
        <label className={styles.field}><span>Cabang</span><select className={styles.select} value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>)}</select></label>
      </div>}

      <nav className={styles.tabs} aria-label="Master inventory">
        {(canManage
          ? ([['WAREHOUSE', 'Warehouse & Lokasi'], ['UOM', 'UOM'], ['PRODUCT', 'Produk'], ['BATCH', 'Batch']] as const)
          : ([['UOM', 'UOM & Preview Konversi']] as const)
        ).map(([value, label]) => <button key={value} className={`${styles.tab} ${tab === value ? styles.tabActive : ''}`} onClick={() => setTab(value)}>{label}</button>)}
      </nav>

      {error && <div className={styles.error}>{error}</div>}
      {loading ? <div className={styles.loading}>Memuat master data...</div> : (
        <>
          {tab === 'WAREHOUSE' && <section>
            {canManage && <form className={styles.form} onSubmit={(event) => void submit(event, () => inventoryApi.createWarehouse({ branchId, ...warehouseForm }), () => setWarehouseForm({ code: '', name: '', isDefault: false }))}>
              <label className={styles.field}><span>Kode warehouse</span><input className={styles.input} required value={warehouseForm.code} onChange={(event) => setWarehouseForm({ ...warehouseForm, code: event.target.value })} /></label>
              <label className={styles.field}><span>Nama</span><input className={styles.input} required value={warehouseForm.name} onChange={(event) => setWarehouseForm({ ...warehouseForm, name: event.target.value })} /></label>
              <label><input type="checkbox" checked={warehouseForm.isDefault} onChange={(event) => setWarehouseForm({ ...warehouseForm, isDefault: event.target.checked })} /> Default</label>
              <button className={styles.button} disabled={saving || !branchId}><Plus size={15} /> Warehouse</button>
            </form>}
            {canManage && <form className={styles.form} onSubmit={(event) => void submit(event, () => inventoryApi.createStockLocation(locationForm), () => setLocationForm({ warehouseId: '', code: '', name: '' }))}>
              <label className={styles.field}><span>Warehouse</span><select className={styles.select} required disabled={warehouses.length === 0} value={locationForm.warehouseId} onChange={(event) => setLocationForm({ ...locationForm, warehouseId: event.target.value })}><option value="">{warehouses.length === 0 ? 'Buat warehouse terlebih dahulu' : 'Pilih'}</option>{warehouses.filter((warehouse) => warehouse.isActive).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}</select></label>
              <label className={styles.field}><span>Kode lokasi</span><input className={styles.input} required value={locationForm.code} onChange={(event) => setLocationForm({ ...locationForm, code: event.target.value })} /></label>
              <label className={styles.field}><span>Nama lokasi</span><input className={styles.input} required value={locationForm.name} onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })} /></label>
              <button className={styles.button} disabled={saving || warehouses.length === 0}><Plus size={15} /> Lokasi</button>
            </form>}
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Kode</th><th>Warehouse</th><th>Cabang</th><th>Lokasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{warehouses.length === 0 ? <tr><td colSpan={6}><div className={styles.emptyState}><strong>Belum ada warehouse untuk cabang ini.</strong><span>Siapkan penyimpanan utama agar lokasi dan transaksi inventory dapat digunakan.</span>{canManage && <button type="button" className={styles.button} disabled={saving || !branchId} onClick={() => void createDefaultStorage()}><Plus size={15} /> Siapkan Warehouse Default</button>}</div></td></tr> : warehouses.map((warehouse) => <tr key={warehouse.id}><td>{warehouse.code}</td><td>{warehouse.name}</td><td>{warehouse.branch?.name}</td><td>{warehouse.locations?.map((location: Row) => `${location.code} - ${location.name}`).join(', ') || '-'}</td><td><span className={warehouse.isActive ? styles.badge : styles.inactiveBadge}>{warehouse.isDefault ? 'Default' : warehouse.isActive ? 'Aktif' : 'Nonaktif'}</span></td><td>{canManage && !warehouse.isDefault && warehouse.isActive ? <button className={styles.dangerButton} title="Nonaktifkan" onClick={() => void submit({ preventDefault() {} } as FormEvent, () => inventoryApi.deactivateWarehouse(warehouse.id), () => undefined)}><Trash2 size={14} /></button> : '-'}</td></tr>)}</tbody></table></div>
          </section>}

          {tab === 'UOM' && <section>
            {canManage && <form className={styles.form} onSubmit={(event) => void submit(event, () => inventoryApi.createUom(uomForm), () => setUomForm({ code: '', name: '', category: 'GENERAL', precision: 4 }))}>
              <label className={styles.field}><span>Kode</span><input className={styles.input} required value={uomForm.code} onChange={(event) => setUomForm({ ...uomForm, code: event.target.value })} /></label>
              <label className={styles.field}><span>Nama</span><input className={styles.input} required value={uomForm.name} onChange={(event) => setUomForm({ ...uomForm, name: event.target.value })} /></label>
              <label className={styles.field}><span>Kategori</span><input className={styles.input} value={uomForm.category} onChange={(event) => setUomForm({ ...uomForm, category: event.target.value })} /></label>
              <label className={styles.field}><span>Presisi</span><input className={styles.input} type="number" min="0" max="6" value={uomForm.precision} onChange={(event) => setUomForm({ ...uomForm, precision: Number(event.target.value) })} /></label>
              <button className={styles.button} disabled={saving}><Plus size={15} /> UOM</button>
            </form>}
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Kode</th><th>Nama</th><th>Kategori</th><th>Presisi</th><th>Status</th></tr></thead><tbody>{uoms.map((uom) => <tr key={uom.id}><td>{uom.code}</td><td>{uom.name}</td><td>{uom.category || '-'}</td><td>{uom.precision}</td><td><span className={uom.isActive ? styles.badge : styles.inactiveBadge}>{uom.isActive ? 'Aktif' : 'Nonaktif'}</span></td></tr>)}</tbody></table></div>
            {canManage && <>
              <h2>Konfigurasi conversion produk</h2>
              <form className={styles.form} onSubmit={(event) => void submit(
                event,
                () => inventoryApi.updateMasterProduct(conversionForm.productId, {
                  baseUomId: conversionForm.baseUomId,
                  usageUomId: conversionForm.usageUomId,
                  conversionFactor: conversionForm.factor,
                }),
                () => undefined,
              )}>
                <label className={styles.field}><span>Produk</span><select className={styles.select} required value={conversionForm.productId} onChange={(event) => selectConversionProduct(event.target.value)}><option value="">Pilih produk</option>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></label>
                <label className={styles.field}><span>Base UOM</span><select className={styles.select} required value={conversionForm.baseUomId} onChange={(event) => setConversionForm({ ...conversionForm, baseUomId: event.target.value })}><option value="">Pilih</option>{uoms.filter((uom) => uom.isActive).map((uom) => <option key={uom.id} value={uom.id}>{uom.code}</option>)}</select></label>
                <label className={styles.field}><span>Usage UOM</span><select className={styles.select} required value={conversionForm.usageUomId} onChange={(event) => setConversionForm({ ...conversionForm, usageUomId: event.target.value })}><option value="">Pilih</option>{uoms.filter((uom) => uom.isActive).map((uom) => <option key={uom.id} value={uom.id}>{uom.code}</option>)}</select></label>
                <label className={styles.field}><span>1 base = usage</span><input className={styles.input} required inputMode="decimal" value={conversionForm.factor} onChange={(event) => { const factor = event.target.value; setConversionForm({ ...conversionForm, factor }); setPreviewForm((current) => ({ ...current, factor })); }} /></label>
                <button className={styles.button} disabled={saving || !conversionForm.productId}><Plus size={15} /> Simpan Conversion</button>
              </form>
            </>}
            <h2>Preview conversion</h2>
            <form className={styles.form} onSubmit={(event) => void previewConversion(event)}>
              <label className={styles.field}><span>Produk (opsional)</span><select className={styles.select} value={conversionForm.productId} onChange={(event) => selectConversionProduct(event.target.value)}><option value="">Input faktor manual</option>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></label>
              <label className={styles.field}><span>Quantity</span><input className={styles.input} required inputMode="decimal" value={previewForm.quantity} onChange={(event) => setPreviewForm({ ...previewForm, quantity: event.target.value })} /></label>
              <label className={styles.field}><span>Faktor</span><input className={styles.input} required inputMode="decimal" value={previewForm.factor} onChange={(event) => setPreviewForm({ ...previewForm, factor: event.target.value })} /></label>
              <label className={styles.field}><span>Arah</span><select className={styles.select} value={previewForm.direction} onChange={(event) => setPreviewForm({ ...previewForm, direction: event.target.value as 'BASE_TO_USAGE' | 'USAGE_TO_BASE' })}><option value="BASE_TO_USAGE">Base → Usage</option><option value="USAGE_TO_BASE">Usage → Base</option></select></label>
              <button className={styles.button} disabled={saving}>Preview</button>
              {previewResult && <output className={styles.badge}>Hasil: {previewResult} {previewForm.direction === 'BASE_TO_USAGE' ? selectedConversionProduct?.usageUom?.code || 'usage unit' : selectedConversionProduct?.baseUom?.code || 'base unit'}</output>}
            </form>
          </section>}

          {tab === 'PRODUCT' && <section>
            {canManage && <form className={styles.form} onSubmit={(event) => void submit(event, () => inventoryApi.createMasterProduct(productForm), () => setProductForm({ sku: '', name: '', category: 'CONSUMABLE', baseUomId: '', usageUomId: '', conversionFactor: '1', tracksBatch: false, tracksExpiry: false }))}>
              <label className={styles.field}><span>SKU</span><input className={styles.input} required value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} /></label>
              <label className={styles.field}><span>Nama produk</span><input className={styles.input} required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
              <label className={styles.field}><span>Kategori</span><select className={styles.select} value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}><option>MEDICINE</option><option>DEVICE</option><option>CONSUMABLE</option></select></label>
              <label className={styles.field}><span>Base UOM</span><select className={styles.select} required value={productForm.baseUomId} onChange={(event) => setProductForm({ ...productForm, baseUomId: event.target.value })}><option value="">Pilih</option>{uoms.map((uom) => <option key={uom.id} value={uom.id}>{uom.code}</option>)}</select></label>
              <label className={styles.field}><span>Usage UOM</span><select className={styles.select} required value={productForm.usageUomId} onChange={(event) => setProductForm({ ...productForm, usageUomId: event.target.value })}><option value="">Pilih</option>{uoms.map((uom) => <option key={uom.id} value={uom.id}>{uom.code}</option>)}</select></label>
              <label className={styles.field}><span>Faktor konversi</span><input className={styles.input} required value={productForm.conversionFactor} onChange={(event) => setProductForm({ ...productForm, conversionFactor: event.target.value })} /></label>
              <label><input type="checkbox" checked={productForm.tracksBatch} onChange={(event) => setProductForm({ ...productForm, tracksBatch: event.target.checked, tracksExpiry: event.target.checked ? productForm.tracksExpiry : false })} /> Batch</label>
              <label><input type="checkbox" disabled={!productForm.tracksBatch} checked={productForm.tracksExpiry} onChange={(event) => setProductForm({ ...productForm, tracksExpiry: event.target.checked })} /> Expiry</label>
              <button className={styles.button} disabled={saving}><Plus size={15} /> Produk</button>
            </form>}
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>SKU</th><th>Produk</th><th>Kategori</th><th>Konversi</th><th>Tracking</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.sku || '-'}</td><td>{product.name}</td><td>{product.category}</td><td>{product.baseUnit} x {String(product.conversionFactor)} {product.usageUnit}</td><td>{product.tracksBatch ? `Batch${product.tracksExpiry ? ' + Expiry' : ''}` : '-'}</td><td><span className={product.isActive ? styles.badge : styles.inactiveBadge}>{product.isActive ? 'Aktif' : 'Nonaktif'}</span></td><td>{canManage && product.isActive ? <button className={styles.dangerButton} title="Nonaktifkan produk" onClick={() => void submit({ preventDefault() {} } as FormEvent, () => inventoryApi.updateMasterProduct(product.id, { isActive: false }), () => undefined)}><Trash2 size={14} /></button> : '-'}</td></tr>)}</tbody></table></div>
          </section>}

          {tab === 'BATCH' && <section>
            {canManage && <form className={styles.form} onSubmit={(event) => void submit(event, () => inventoryApi.createBatch({ ...batchForm, manufactureDate: batchForm.manufactureDate || undefined, expiryDate: batchForm.expiryDate || undefined }), () => setBatchForm({ masterProductId: '', batchNumber: '', manufactureDate: '', expiryDate: '' }))}>
              <label className={styles.field}><span>Produk</span><select className={styles.select} required value={batchForm.masterProductId} onChange={(event) => setBatchForm({ ...batchForm, masterProductId: event.target.value })}><option value="">Pilih</option>{activeProducts.filter((product) => product.tracksBatch).map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></label>
              <label className={styles.field}><span>Nomor batch</span><input className={styles.input} required value={batchForm.batchNumber} onChange={(event) => setBatchForm({ ...batchForm, batchNumber: event.target.value })} /></label>
              <label className={styles.field}><span>Manufacture</span><input className={styles.input} type="date" value={batchForm.manufactureDate} onChange={(event) => setBatchForm({ ...batchForm, manufactureDate: event.target.value })} /></label>
              <label className={styles.field}><span>Expiry</span><input className={styles.input} type="date" value={batchForm.expiryDate} onChange={(event) => setBatchForm({ ...batchForm, expiryDate: event.target.value })} /></label>
              <button className={styles.button} disabled={saving}><Plus size={15} /> Batch</button>
            </form>}
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Batch</th><th>Produk</th><th>Manufacture</th><th>Expiry</th><th>Status</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td>{batch.batchNumber}</td><td>{batch.masterProduct?.name}</td><td>{batch.manufactureDate ? new Date(batch.manufactureDate).toLocaleDateString('id-ID') : '-'}</td><td>{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('id-ID') : '-'}</td><td><span className={batch.isBlocked ? styles.inactiveBadge : styles.badge}>{batch.isBlocked ? 'Diblokir' : 'Aktif'}</span></td></tr>)}</tbody></table></div>
          </section>}
        </>
      )}
    </main>
  );
}
