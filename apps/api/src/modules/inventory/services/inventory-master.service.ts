import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  assertPermission,
  getAccessibleBranchIds,
} from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { buildChangedFields, logAudit } from '@utils/auditLog';
import type {
  CreateBatchInput,
  CreateMasterProductInput,
  CreateStockLocationInput,
  CreateUomInput,
  CreateWarehouseInput,
  MasterListQuery,
  UpdateBatchInput,
  UpdateMasterProductInput,
  UpdateStockLocationInput,
  UpdateUomInput,
  UpdateWarehouseInput,
} from '../inventory-master.schema';

async function scopedBranchWhere(userId: string, branchId?: string) {
  if (branchId) {
    await assertBranchAccess(userId, branchId);
    return { branchId };
  }
  const ids = await getAccessibleBranchIds(userId);
  return ids === null ? {} : { branchId: { in: ids } };
}

async function getWarehouseInScope(userId: string, warehouseId: string) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw errors.notFound('Warehouse tidak ditemukan.');
  await assertBranchAccess(userId, warehouse.branchId);
  return warehouse;
}

async function getLocationInScope(userId: string, locationId: string) {
  const location = await prisma.stockLocation.findUnique({
    where: { id: locationId },
    include: { warehouse: true },
  });
  if (!location) throw errors.notFound('Stock location tidak ditemukan.');
  await assertBranchAccess(userId, location.warehouse.branchId);
  return location;
}

export async function listWarehouses(userId: string, query: MasterListQuery) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_READ, query.branchId);
  const branchWhere = await scopedBranchWhere(userId, query.branchId);
  return prisma.warehouse.findMany({
    where: {
      ...branchWhere,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search ? {
        OR: [
          { code: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
          { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
        ],
      } : {}),
    },
    include: { branch: { select: { id: true, branchCode: true, name: true, type: true } }, locations: true },
    orderBy: [{ branch: { branchCode: 'asc' } }, { isDefault: 'desc' }, { code: 'asc' }],
  });
}

export async function createWarehouse(userId: string, input: CreateWarehouseInput) {
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE, input.branchId);
  const created = await prisma.$transaction(async (tx) => {
    const makeDefault = input.isDefault || await tx.warehouse.count({ where: { branchId: input.branchId } }) === 0;
    if (makeDefault) {
      await tx.warehouse.updateMany({ where: { branchId: input.branchId, isDefault: true }, data: { isDefault: false } });
    }
    const warehouse = await tx.warehouse.create({
      data: {
        branchId: input.branchId,
        code: input.code,
        name: input.name,
        isDefault: makeDefault,
        createdBy: userId,
      },
    });
    if (makeDefault) {
      await tx.stockLocation.create({
        data: { warehouseId: warehouse.id, code: 'DEFAULT', name: 'Lokasi Utama', isDefault: true, createdBy: userId },
      });
    }
    return warehouse;
  });
  await logAudit({ userId, branchId: input.branchId, action: 'CREATE', resource: 'Warehouse', resourceId: created.id, afterData: created });
  return created;
}

export async function updateWarehouse(userId: string, id: string, input: UpdateWarehouseInput) {
  const before = await getWarehouseInScope(userId, id);
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE, before.branchId);
  if (input.isActive === false && before.isDefault) throw errors.conflict('DEFAULT_WAREHOUSE_REQUIRED', 'Warehouse default tidak dapat dinonaktifkan.');
  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.warehouse.updateMany({ where: { branchId: before.branchId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return tx.warehouse.update({ where: { id }, data: input });
  });
  await logAudit({
    userId, branchId: before.branchId, action: 'UPDATE', resource: 'Warehouse', resourceId: id,
    beforeData: before, afterData: updated, changedFields: buildChangedFields(before, updated),
  });
  return updated;
}

export async function deactivateWarehouse(userId: string, id: string) {
  const warehouse = await getWarehouseInScope(userId, id);
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE, warehouse.branchId);
  if (warehouse.isDefault) throw errors.conflict('DEFAULT_WAREHOUSE_REQUIRED', 'Warehouse default tidak dapat dinonaktifkan.');
  const updated = await prisma.warehouse.update({ where: { id }, data: { isActive: false } });
  await logAudit({ userId, branchId: warehouse.branchId, action: 'DELETE', resource: 'Warehouse', resourceId: id, beforeData: warehouse, afterData: updated });
  return updated;
}

export async function listStockLocations(userId: string, warehouseId: string, includeInactive = false) {
  const warehouse = await getWarehouseInScope(userId, warehouseId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_READ, warehouse.branchId);
  return prisma.stockLocation.findMany({
    where: { warehouseId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
  });
}

export async function createStockLocation(userId: string, input: CreateStockLocationInput) {
  const warehouse = await getWarehouseInScope(userId, input.warehouseId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE, warehouse.branchId);
  const created = await prisma.$transaction(async (tx) => {
    const makeDefault = input.isDefault || await tx.stockLocation.count({ where: { warehouseId: input.warehouseId } }) === 0;
    if (makeDefault) {
      await tx.stockLocation.updateMany({ where: { warehouseId: input.warehouseId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.stockLocation.create({
      data: {
        warehouseId: input.warehouseId,
        code: input.code,
        name: input.name,
        isDefault: makeDefault,
        createdBy: userId,
      },
    });
  });
  await logAudit({ userId, branchId: warehouse.branchId, action: 'CREATE', resource: 'StockLocation', resourceId: created.id, afterData: created });
  return created;
}

export async function updateStockLocation(userId: string, id: string, input: UpdateStockLocationInput) {
  const before = await getLocationInScope(userId, id);
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE, before.warehouse.branchId);
  if (input.isActive === false && before.isDefault) throw errors.conflict('DEFAULT_LOCATION_REQUIRED', 'Stock location default tidak dapat dinonaktifkan.');
  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.stockLocation.updateMany({ where: { warehouseId: before.warehouseId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return tx.stockLocation.update({ where: { id }, data: input });
  });
  await logAudit({
    userId, branchId: before.warehouse.branchId, action: 'UPDATE', resource: 'StockLocation', resourceId: id,
    beforeData: before, afterData: updated, changedFields: buildChangedFields(before, updated),
  });
  return updated;
}

export async function deactivateStockLocation(userId: string, id: string) {
  const before = await getLocationInScope(userId, id);
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE, before.warehouse.branchId);
  if (before.isDefault) throw errors.conflict('DEFAULT_LOCATION_REQUIRED', 'Stock location default tidak dapat dinonaktifkan.');
  const updated = await prisma.stockLocation.update({ where: { id }, data: { isActive: false } });
  await logAudit({ userId, branchId: before.warehouse.branchId, action: 'DELETE', resource: 'StockLocation', resourceId: id, beforeData: before, afterData: updated });
  return updated;
}

export async function listUoms(userId: string, includeInactive = false) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_READ);
  return prisma.unitOfMeasure.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { code: 'asc' } });
}

export async function createUom(userId: string, input: CreateUomInput) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE);
  const created = await prisma.unitOfMeasure.create({
    data: { code: input.code, name: input.name, category: input.category, precision: input.precision },
  });
  await logAudit({ userId, action: 'CREATE', resource: 'UnitOfMeasure', resourceId: created.id, afterData: created });
  return created;
}

export async function updateUom(userId: string, id: string, input: UpdateUomInput) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE);
  const before = await prisma.unitOfMeasure.findUnique({ where: { id } });
  if (!before) throw errors.notFound('UOM tidak ditemukan.');
  const updated = await prisma.unitOfMeasure.update({ where: { id }, data: input });
  await logAudit({ userId, action: 'UPDATE', resource: 'UnitOfMeasure', resourceId: id, beforeData: before, afterData: updated, changedFields: buildChangedFields(before, updated) });
  return updated;
}

async function resolveProductUoms(baseUomId: string, usageUomId: string) {
  const uoms = await prisma.unitOfMeasure.findMany({ where: { id: { in: [baseUomId, usageUomId] }, isActive: true } });
  if (uoms.length !== new Set([baseUomId, usageUomId]).size) throw errors.badRequest('INVALID_UOM', 'Base UOM atau usage UOM tidak valid.');
  return {
    base: uoms.find((uom) => uom.id === baseUomId)!,
    usage: uoms.find((uom) => uom.id === usageUomId)!,
  };
}

export async function createMasterProduct(userId: string, input: CreateMasterProductInput) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE);
  if (input.tracksExpiry && !input.tracksBatch) throw errors.badRequest('BATCH_REQUIRED_FOR_EXPIRY', 'Expiry tracking memerlukan batch tracking.');
  const uoms = await resolveProductUoms(input.baseUomId, input.usageUomId);
  const factor = new Prisma.Decimal(input.conversionFactor);
  if (input.baseUomId === input.usageUomId && !factor.equals(1)) throw errors.badRequest('INVALID_UOM_CONVERSION', 'UOM yang sama harus memakai conversion factor 1.');

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.masterProduct.create({
      data: {
        sku: input.sku, name: input.name, category: input.category, description: input.description,
        unit: uoms.base.name, baseUnit: uoms.base.name, usageUnit: uoms.usage.name,
        baseUomId: input.baseUomId, usageUomId: input.usageUomId, conversionFactor: factor,
        tracksBatch: input.tracksBatch, tracksExpiry: input.tracksExpiry,
        isAutoUsedPerSession: input.isAutoUsedPerSession, isAutoAddedToBranch: input.isAutoAddedToBranch,
      },
    });
    await tx.unitConversion.create({ data: { masterProductId: created.id, fromUomId: input.baseUomId, toUomId: input.usageUomId, factor } });
    return created;
  });
  await logAudit({ userId, action: 'CREATE', resource: 'MasterProduct', resourceId: product.id, entityCode: product.sku, afterData: product });
  return product;
}

export async function updateMasterProduct(userId: string, id: string, input: UpdateMasterProductInput) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE);
  const before = await prisma.masterProduct.findUnique({ where: { id } });
  if (!before) throw errors.notFound('Product tidak ditemukan.');
  const baseUomId = input.baseUomId ?? before.baseUomId;
  const usageUomId = input.usageUomId ?? before.usageUomId;
  if (!baseUomId || !usageUomId) throw errors.badRequest('INVALID_UOM', 'Product harus memiliki base dan usage UOM.');
  const tracksBatch = input.tracksBatch ?? before.tracksBatch;
  const tracksExpiry = input.tracksExpiry ?? before.tracksExpiry;
  if (tracksExpiry && !tracksBatch) throw errors.badRequest('BATCH_REQUIRED_FOR_EXPIRY', 'Expiry tracking memerlukan batch tracking.');
  const uoms = await resolveProductUoms(baseUomId, usageUomId);
  const factor = new Prisma.Decimal(input.conversionFactor ?? before.conversionFactor);
  if (baseUomId === usageUomId && !factor.equals(1)) throw errors.badRequest('INVALID_UOM_CONVERSION', 'UOM yang sama harus memakai conversion factor 1.');

  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.masterProduct.update({
      where: { id },
      data: {
        ...input,
        conversionFactor: factor,
        baseUomId,
        usageUomId,
        baseUnit: uoms.base.name,
        usageUnit: uoms.usage.name,
        unit: uoms.base.name,
      },
    });
    await tx.unitConversion.upsert({
      where: { masterProductId_fromUomId_toUomId: { masterProductId: id, fromUomId: baseUomId, toUomId: usageUomId } },
      create: { masterProductId: id, fromUomId: baseUomId, toUomId: usageUomId, factor },
      update: { factor, isActive: true },
    });
    return product;
  });
  await logAudit({ userId, action: 'UPDATE', resource: 'MasterProduct', resourceId: id, entityCode: updated.sku, beforeData: before, afterData: updated, changedFields: buildChangedFields(before, updated) });
  return updated;
}

export async function listBatches(userId: string, masterProductId?: string, includeBlocked = false) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_READ);
  return prisma.inventoryBatch.findMany({
    where: { ...(masterProductId ? { masterProductId } : {}), ...(includeBlocked ? {} : { isBlocked: false }) },
    include: { masterProduct: { select: { sku: true, name: true, tracksExpiry: true } } },
    orderBy: [{ expiryDate: 'asc' }, { batchNumber: 'asc' }],
  });
}

export async function createBatch(userId: string, input: CreateBatchInput) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE);
  const product = await prisma.masterProduct.findUnique({ where: { id: input.masterProductId } });
  if (!product?.isActive) throw errors.badRequest('INVALID_PRODUCT', 'Product tidak aktif atau tidak ditemukan.');
  if (!product.tracksBatch) throw errors.badRequest('BATCH_NOT_ENABLED', 'Batch tracking belum aktif untuk product ini.');
  if (product.tracksExpiry && !input.expiryDate) throw errors.badRequest('EXPIRY_REQUIRED', 'Expiry date wajib untuk product ini.');
  const created = await prisma.inventoryBatch.create({
    data: {
      masterProductId: input.masterProductId,
      batchNumber: input.batchNumber,
      manufactureDate: input.manufactureDate,
      expiryDate: input.expiryDate,
    },
  });
  await logAudit({ userId, action: 'CREATE', resource: 'InventoryBatch', resourceId: created.id, afterData: created });
  return created;
}

export async function updateBatch(userId: string, id: string, input: UpdateBatchInput) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_MASTER_MANAGE);
  const before = await prisma.inventoryBatch.findUnique({ where: { id } });
  if (!before) throw errors.notFound('Batch tidak ditemukan.');
  const manufactureDate = input.manufactureDate === undefined ? before.manufactureDate : input.manufactureDate;
  const expiryDate = input.expiryDate === undefined ? before.expiryDate : input.expiryDate;
  if (manufactureDate && expiryDate && expiryDate <= manufactureDate) throw errors.badRequest('INVALID_BATCH_DATES', 'Expiry date harus setelah manufacture date.');
  const updated = await prisma.inventoryBatch.update({ where: { id }, data: input });
  await logAudit({ userId, action: 'UPDATE', resource: 'InventoryBatch', resourceId: id, beforeData: before, afterData: updated, changedFields: buildChangedFields(before, updated) });
  return updated;
}
