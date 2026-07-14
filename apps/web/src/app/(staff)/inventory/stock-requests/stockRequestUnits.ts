const NB_HHO_SKU = 'PRD-NBT-HHO-001';

interface StockRequestUnitProduct {
  sku?: string | null;
  name?: string | null;
  unit?: string | null;
  baseUnit?: string | null;
  usageUnit?: string | null;
  conversionFactor?: number | null;
}

function normalizeText(value?: string | null): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isNbHhoProduct(product?: StockRequestUnitProduct | null): boolean {
  const sku = String(product?.sku || '').toUpperCase();
  const normalizedName = normalizeText(product?.name);

  return sku === NB_HHO_SKU || normalizedName === 'nbhho' || normalizedName.startsWith('nbhho');
}

export function getStockRequestUnit(product?: StockRequestUnitProduct | null): string {
  if (isNbHhoProduct(product)) {
    return product?.usageUnit || 'ml';
  }

  return product?.baseUnit || product?.unit || product?.usageUnit || 'unit';
}
