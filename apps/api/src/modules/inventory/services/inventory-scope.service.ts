import { Prisma } from '@prisma/client';
import { errors } from '@middleware/errorHandler';

type Tx = Prisma.TransactionClient;

/**
 * Warehouse dan stock location tetap disimpan sebagai detail internal untuk
 * kompatibilitas ledger lama. Flow operasional hanya memilih cabang; service
 * ini memastikan cabang selalu memiliki satu scope stok kanonis.
 */
export async function resolveBranchInventoryScope(
  tx: Tx,
  branchId: string,
  actorUserId = 'system',
) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { id: true, isActive: true },
  });
  if (!branch) throw errors.notFound('Cabang inventory tidak ditemukan.');
  if (!branch.isActive) {
    throw errors.badRequest('INVENTORY_SCOPE_BRANCH_INACTIVE', 'Cabang inventory sudah tidak aktif.');
  }

  let warehouse = await tx.warehouse.findFirst({
    where: { branchId },
    orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!warehouse) {
    warehouse = await tx.warehouse.upsert({
      where: { branchId_code: { branchId, code: 'DEFAULT' } },
      create: {
        branchId,
        code: 'DEFAULT',
        name: 'Scope Stok Cabang',
        isDefault: true,
        createdBy: actorUserId,
      },
      update: { isActive: true, isDefault: true },
    });
  } else if (!warehouse.isActive || !warehouse.isDefault) {
    warehouse = await tx.warehouse.update({
      where: { id: warehouse.id },
      data: { isActive: true, isDefault: true },
    });
  }

  let location = await tx.stockLocation.findFirst({
    where: { warehouseId: warehouse.id },
    orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!location) {
    location = await tx.stockLocation.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code: 'DEFAULT' } },
      create: {
        warehouseId: warehouse.id,
        code: 'DEFAULT',
        name: 'Scope Stok Cabang',
        isDefault: true,
        createdBy: actorUserId,
      },
      update: { isActive: true, isDefault: true },
    });
  } else if (!location.isActive || !location.isDefault) {
    location = await tx.stockLocation.update({
      where: { id: location.id },
      data: { isActive: true, isDefault: true },
    });
  }

  return { warehouse, location };
}
