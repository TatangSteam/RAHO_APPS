import { Prisma, ZohoDataOrigin, ZohoManagementMode } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';

export async function resolveMappingOrigin(input: {
  mappingId: string;
  actorUserId: string;
  dataOrigin: Exclude<ZohoDataOrigin, 'UNKNOWN'>;
  managementMode: Exclude<ZohoManagementMode, 'REVIEW_REQUIRED'>;
  note: string;
}) {
  const mapping = await prisma.zohoEntityMapping.findUnique({ where: { id: input.mappingId } });
  if (!mapping) throw new AppError(404, 'ZOHO_MAPPING_NOT_FOUND', 'Mapping Zoho tidak ditemukan.');
  const connection = await prisma.zohoConnection.findUnique({ where: { id: mapping.zohoConnectionId } });
  if (!connection?.isActive) {
    throw new AppError(409, 'ZOHO_MAPPING_CONNECTION_INACTIVE', 'Mapping bukan milik koneksi Zoho aktif.');
  }
  const previousMetadata = mapping.metadata && typeof mapping.metadata === 'object' && !Array.isArray(mapping.metadata)
    ? mapping.metadata as Prisma.JsonObject
    : {};
  return prisma.zohoEntityMapping.update({
    where: { id: mapping.id },
    data: {
      dataOrigin: input.dataOrigin,
      managementMode: input.managementMode,
      originVerifiedAt: new Date(),
      metadata: {
        ...previousMetadata,
        originResolution: {
          actorUserId: input.actorUserId,
          resolvedAt: new Date().toISOString(),
          note: input.note,
          previousOrigin: mapping.dataOrigin,
          previousManagementMode: mapping.managementMode,
        },
      },
    },
  });
}
