// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for managing master booster types and service types
 */
export class MasterTypesAdminService {
  // ══════════════════════════════════════════════════════════════
  // BOOSTER TYPES
  // ══════════════════════════════════════════════════════════════

  async getAllBoosterTypes(filters: { isActive?: boolean } = {}) {
    const where: any = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const types = await prisma.masterBoosterType.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return types.map(t => ({
      id: t.id,
      code: t.code,
      name: t.name,
      icon: t.icon,
      description: t.description,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  async createBoosterType(data: {
    code: string;
    name: string;
    icon?: string;
    description?: string;
    sortOrder?: number;
  }) {
    // Check if code already exists
    const existing = await prisma.masterBoosterType.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'CODE_EXISTS',
        message: 'Kode tipe booster sudah digunakan',
      };
    }

    const type = await prisma.masterBoosterType.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        icon: data.icon,
        description: data.description,
        sortOrder: data.sortOrder ?? 999,
      },
    });

    return {
      id: type.id,
      code: type.code,
      name: type.name,
      icon: type.icon,
      description: type.description,
      isActive: type.isActive,
      sortOrder: type.sortOrder,
      createdAt: type.createdAt.toISOString(),
      updatedAt: type.updatedAt.toISOString(),
    };
  }

  async updateBoosterType(
    id: string,
    data: {
      name?: string;
      icon?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    const type = await prisma.masterBoosterType.findUnique({
      where: { id },
    });

    if (!type) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Tipe booster tidak ditemukan',
      };
    }

    const updated = await prisma.masterBoosterType.update({
      where: { id },
      data,
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      icon: updated.icon,
      description: updated.description,
      isActive: updated.isActive,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteBoosterType(id: string) {
    const type = await prisma.masterBoosterType.findUnique({
      where: { id },
    });

    if (!type) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Tipe booster tidak ditemukan',
      };
    }

    // Check if being used
    const usageCount = await prisma.packagePricing.count({
      where: { boosterType: type.code as any },
    });

    if (usageCount > 0) {
      throw {
        status: 409,
        code: 'IN_USE',
        message: `Tipe booster tidak dapat dihapus karena sedang digunakan oleh ${usageCount} paket`,
      };
    }

    await prisma.masterBoosterType.delete({
      where: { id },
    });

    return { message: 'Tipe booster berhasil dihapus' };
  }

  // ══════════════════════════════════════════════════════════════
  // SERVICE TYPES
  // ══════════════════════════════════════════════════════════════

  async getAllServiceTypes(filters: { isActive?: boolean } = {}) {
    const where: any = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const types = await prisma.masterServiceType.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return types.map(t => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  async createServiceType(data: {
    code: string;
    name: string;
    description?: string;
    sortOrder?: number;
  }) {
    // Check if code already exists
    const existing = await prisma.masterServiceType.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'CODE_EXISTS',
        message: 'Kode tipe layanan sudah digunakan',
      };
    }

    const type = await prisma.masterServiceType.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder ?? 999,
      },
    });

    return {
      id: type.id,
      code: type.code,
      name: type.name,
      description: type.description,
      isActive: type.isActive,
      sortOrder: type.sortOrder,
      createdAt: type.createdAt.toISOString(),
      updatedAt: type.updatedAt.toISOString(),
    };
  }

  async updateServiceType(
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    const type = await prisma.masterServiceType.findUnique({
      where: { id },
    });

    if (!type) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Tipe layanan tidak ditemukan',
      };
    }

    const updated = await prisma.masterServiceType.update({
      where: { id },
      data,
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      isActive: updated.isActive,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteServiceType(id: string) {
    const type = await prisma.masterServiceType.findUnique({
      where: { id },
    });

    if (!type) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Tipe layanan tidak ditemukan',
      };
    }

    // Check if being used
    const usageCount = await prisma.packagePricing.count({
      where: { serviceType: type.code },
    });

    if (usageCount > 0) {
      throw {
        status: 409,
        code: 'IN_USE',
        message: `Tipe layanan tidak dapat dihapus karena sedang digunakan oleh ${usageCount} paket`,
      };
    }

    await prisma.masterServiceType.delete({
      where: { id },
    });

    return { message: 'Tipe layanan berhasil dihapus' };
  }
}
