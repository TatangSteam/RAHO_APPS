const NB_HHO_SKU = 'PRD-NBT-HHO-001';

export interface StockRequestUnitProduct {
  sku?: string | null;
  name?: string | null;
  unit?: string | null;
  baseUnit?: string | null;
  usageUnit?: string | null;
  conversionFactor?: unknown;
}

function normalizeText(value?: string | null): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeUnit(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function getConversionFactor(product?: StockRequestUnitProduct | null): number {
  const factor = Number(product?.conversionFactor || 1);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
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

export function usesUsageUnitForStockRequest(product?: StockRequestUnitProduct | null): boolean {
  if (!isNbHhoProduct(product)) {
    return false;
  }

  const baseUnit = normalizeUnit(product?.baseUnit || product?.unit);
  const requestUnit = normalizeUnit(getStockRequestUnit(product));

  return Boolean(baseUnit && requestUnit && baseUnit !== requestUnit);
}

export function formatStockRequestQuantity(product: StockRequestUnitProduct | null | undefined, quantity: unknown): number {
  const value = Number(quantity || 0);
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (!usesUsageUnitForStockRequest(product)) {
    return value;
  }

  return value * getConversionFactor(product);
}

export function parseStockRequestQuantity(
  product: StockRequestUnitProduct | null | undefined,
  quantity: unknown,
  unit?: string | null
): number {
  const value = Number(quantity || 0);
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (!usesUsageUnitForStockRequest(product)) {
    return value;
  }

  if (normalizeUnit(unit) !== normalizeUnit(getStockRequestUnit(product))) {
    return value;
  }

  return value / getConversionFactor(product);
}
