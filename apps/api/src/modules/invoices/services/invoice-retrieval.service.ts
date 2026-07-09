// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { extractKeyFromUrl, s3Client } from '../../../config/minio';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../../config/env';
import { Readable } from 'stream';
import { InvoiceStatus, Role } from '@prisma/client';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';

/**
 * Service for invoice retrieval
 */
export class InvoiceRetrievalService {
  private getInvoiceInclude() {
    return {
      member: {
        include: {
          referralCode: true,
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
      branch: true,
      createdByUser: {
        include: {
          profile: true,
        },
      },
      verifiedByUser: {
        include: {
          profile: true,
        },
      },
      items: true,
      payments: {
        include: {
          receivedByUser: {
            include: {
              profile: true,
            },
          },
        },
      },
    };
  }

  private async getAccessibleBranchIds(user: { userId: string; role: string; branchId: string | null }) {
    if (user.role === Role.SUPER_ADMIN) {
      return undefined;
    }

    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranches = await prisma.managerBranch.findMany({
        where: { userId: user.userId },
        select: { branchId: true },
      });

      return managerBranches.map((branch) => branch.branchId);
    }

    const branchIds = new Set<string>();
    if (user.branchId) {
      branchIds.add(user.branchId);
    }

    const staffBranches = await prisma.staffBranch.findMany({
      where: { userId: user.userId },
      select: { branchId: true },
    });

    staffBranches.forEach((branch) => branchIds.add(branch.branchId));
    return Array.from(branchIds);
  }

  /**
   * Get invoices for payment dashboard
   */
  async getInvoices(
    user: { userId: string; role: string; branchId: string | null },
    options: { search?: string; status?: string; page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.min(100, Math.max(1, Number(options.limit || 50)));
    const skip = (page - 1) * limit;
    const branchIds = await this.getAccessibleBranchIds(user);

    if (Array.isArray(branchIds) && branchIds.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const where: any = {};
    if (Array.isArray(branchIds)) {
      where.branchId = { in: branchIds };
    }

    if (options.status && Object.values(InvoiceStatus).includes(options.status as InvoiceStatus)) {
      where.status = options.status;
    }

    const search = options.search?.trim();
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        {
          member: {
            is: {
              memberNo: { contains: search, mode: 'insensitive' },
            },
          },
        },
        {
          member: {
            is: {
              user: {
                is: {
                  email: { contains: search, mode: 'insensitive' },
                },
              },
            },
          },
        },
        {
          member: {
            is: {
              user: {
                is: {
                  profile: {
                    is: {
                      fullName: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              },
            },
          },
        },
        {
          branch: {
            is: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [invoices, total] = await Promise.all([
      (prisma as any).invoice.findMany({
        where,
        include: this.getInvoiceInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).invoice.count({ where }),
    ]);

    return {
      data: await Promise.all(invoices.map((invoice: any) => this.formatInvoice(invoice))),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
      include: this.getInvoiceInclude(),
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return this.formatInvoice(invoice);
  }

  /**
   * Get invoice by package/add-on ID
   */
  async getInvoiceByPackageId(packageId: string) {
    const invoice = await (prisma as any).invoice.findFirst({
      where: {
        items: {
          some: {
            itemId: packageId,
          },
        },
      },
      include: this.getInvoiceInclude(),
      orderBy: { createdAt: 'desc' },
    });

    if (!invoice) {
      throw new Error('Invoice not found for this package');
    }

    return this.formatInvoice(invoice);
  }

  /**
   * Get member's invoices
   */
  async getMemberInvoices(memberId: string) {
    const invoices = await (prisma as any).invoice.findMany({
      where: { memberId },
      include: this.getInvoiceInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(invoices.map((inv: any) => this.formatInvoice(inv)));
  }

  /**
   * Get payment proof image (returns private stream)
   */
  async getPaymentProofImage(paymentId: string, user: { userId: string; role: string; branchId: string | null }) {
    const payment = await (prisma as any).invoicePayment.findUnique({
      where: { id: paymentId },
      select: {
        proofFileUrl: true,
        proofFileName: true,
        proofMimeType: true,
        invoice: {
          select: {
            branchId: true,
            member: {
              select: {
                userId: true,
                registrationBranchId: true,
                branchAccesses: {
                  select: {
                    branchId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment || !payment.proofFileUrl) {
      throw new Error('Payment proof not found');
    }

    if (user.role === Role.MEMBER) {
      if (payment.invoice.member.userId !== user.userId) {
        throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
      }
    } else if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN_MANAGER) {
      const accessibleBranchIds = new Set<string>();
      if (user.branchId) accessibleBranchIds.add(user.branchId);

      const staffBranches = await prisma.staffBranch.findMany({
        where: { userId: user.userId },
        select: { branchId: true },
      });

      staffBranches.forEach((row) => accessibleBranchIds.add(row.branchId));

      const invoiceBranchIds = [
        payment.invoice.branchId,
        payment.invoice.member.registrationBranchId,
        ...payment.invoice.member.branchAccesses.map((access) => access.branchId),
      ];

      const hasAccess = invoiceBranchIds.some((branchId) => accessibleBranchIds.has(branchId));
      if (!hasAccess) {
        throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
      }
    }

    // Extract the MinIO key from the stored URL
    const key = extractKeyFromUrl(payment.proofFileUrl);

    try {
      const command = new GetObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
      }

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType || payment.proofMimeType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
        etag: response.ETag || '',
        fileName: payment.proofFileName,
        mimeType: payment.proofMimeType,
      };
    } catch (error: any) {
      const localFile = this.getLocalPaymentProofFile(key, payment);
      if (localFile) {
        return localFile;
      }

      throw error;
    }
  }

  private getLocalPaymentProofFile(key: string, payment: any) {
    const cleanKey = key.split('?')[0];
    const cwd = path.resolve(process.cwd());
    const localPath = path.resolve(cwd, cleanKey);

    if (!localPath.startsWith(cwd) || !existsSync(localPath)) {
      return null;
    }

    const stat = statSync(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.pdf': 'application/pdf',
    };

    return {
      stream: createReadStream(localPath) as unknown as Readable,
      contentType: payment.proofMimeType || contentTypes[ext] || 'application/octet-stream',
      contentLength: stat.size,
      etag: `"${stat.mtimeMs}-${stat.size}"`,
      fileName: payment.proofFileName,
      mimeType: payment.proofMimeType,
    };
  }

  /**
   * Format invoice for API response
   */
  async formatInvoice(invoice: any) {
    const groupPayments = invoice.paymentGroupId
      ? await prisma.invoicePayment.findMany({
          where: {
            invoice: {
              paymentGroupId: invoice.paymentGroupId,
            },
          },
          include: {
            receivedByUser: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: {
            receivedAt: 'asc',
          },
        })
      : invoice.payments;

    // Get incentive information for packages in this invoice
    let incentiveInfo = null;
    
    // Get package IDs from invoice items
    const packageIds = invoice.items
      .filter((item: any) => item.itemType === 'PACKAGE')
      .map((item: any) => item.itemId);
    
    if (packageIds.length > 0 && invoice.member.referralCode) {
      // Get incentive records for these packages
      const incentiveRecords = await prisma.referralIncentiveRecord.findMany({
        where: {
          memberPackageId: {
            in: packageIds,
          },
        },
        include: {
          referralCode: {
            select: {
              code: true,
              referrerName: true,
              referrerType: true,
            },
          },
        },
      });
      
      // If there are incentive records, sum them up
      if (incentiveRecords.length > 0) {
        const totalIncentive = incentiveRecords.reduce(
          (sum, record) => sum + Number(record.incentiveAmount),
          0
        );
        
        // Use the first record for referral info (they should all be the same referral code)
        const firstRecord = incentiveRecords[0];
        
        incentiveInfo = {
          totalAmount: totalIncentive,
          referralCode: firstRecord.referralCode.code,
          referrerName: firstRecord.referralCode.referrerName,
          referrerType: firstRecord.referralCode.referrerType,
          recordCount: incentiveRecords.length,
        };
      }
    }

    const items = await this.formatInvoiceItems(invoice);
    const displaySubtotal = items.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);
    const shouldUseDisplaySubtotal =
      invoice.paymentPlanType === 'INSTALLMENT' &&
      invoice.status === 'PENDING_PAYMENT' &&
      Number(invoice.totalAmount || 0) === 0 &&
      Number(invoice.subtotal || 0) === 0 &&
      displaySubtotal > 0;

    const memberName =
      invoice.member?.user?.profile?.fullName ||
      invoice.member?.user?.email ||
      invoice.member?.memberNo ||
      'Member';
    const createdByName =
      invoice.createdByUser?.profile?.fullName ||
      invoice.createdByUser?.email ||
      '-';
    const verifiedByName =
      invoice.verifiedByUser?.profile?.fullName ||
      invoice.verifiedByUser?.email ||
      undefined;
    
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: invoice.memberId,
      memberName,
      memberNo: invoice.member?.memberNo,
      branchId: invoice.branchId,
      branchName: invoice.branch?.name,
      
      // Financial
      subtotal: shouldUseDisplaySubtotal ? displaySubtotal : Number(invoice.subtotal),
      discountPercent: invoice.discountPercent ? Number(invoice.discountPercent) : undefined,
      discountAmount: invoice.discountAmount && Number(invoice.discountAmount) > 0 ? Number(invoice.discountAmount) : undefined,
      discountNote: invoice.discountNote || undefined,
      taxPercent: invoice.taxPercent && Number(invoice.taxPercent) > 0 ? Number(invoice.taxPercent) : undefined,
      taxAmount: invoice.taxAmount && Number(invoice.taxAmount) > 0 ? Number(invoice.taxAmount) : undefined,
      totalAmount: Number(invoice.totalAmount),
      
      // Incentive information
      incentive: incentiveInfo,
      
      // Status
      status: invoice.status,
      paymentPlanType: invoice.paymentPlanType,
      paymentGroupId: invoice.paymentGroupId || undefined,
      installmentNumber: invoice.installmentNumber || undefined,
      installmentTotal: invoice.installmentTotal || undefined,
      totalPurchaseAmount: invoice.totalPurchaseAmount ? Number(invoice.totalPurchaseAmount) : undefined,
      installmentAmount: invoice.installmentAmount ? Number(invoice.installmentAmount) : undefined,
      carryOverAmount: invoice.carryOverAmount ? Number(invoice.carryOverAmount) : undefined,
      creditAmount: invoice.creditAmount ? Number(invoice.creditAmount) : undefined,
      actualPaidAmount: invoice.actualPaidAmount ? Number(invoice.actualPaidAmount) : undefined,
      paymentVerificationStatus: invoice.paymentVerificationStatus,
      paymentRejectionReason: invoice.paymentRejectionReason || undefined,
      isAdjustment: Boolean(invoice.isAdjustment),
      dueDate: invoice.dueDate?.toISOString(),
      paidAt: invoice.paidAt?.toISOString(),
      cancelledAt: invoice.cancelledAt?.toISOString(),
      
      // Metadata
      notes: invoice.notes || undefined,
      createdBy: invoice.createdBy,
      createdByName,
      verifiedBy: invoice.verifiedBy || undefined,
      verifiedByName,
      verifiedAt: invoice.verifiedAt?.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      
      // Relations
      items,
      payments: groupPayments.map((payment: any) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        paymentReference: payment.paymentReference || undefined,
        notes: payment.notes || undefined,
        proofFileUrl: payment.proofFileUrl ? `/invoices/payment-proof/${payment.id}` : undefined,
        proofFileName: payment.proofFileName || undefined,
        proofFileSize: payment.proofFileSize || undefined,
        proofMimeType: payment.proofMimeType || undefined,
        receivedBy: payment.receivedBy,
        receivedByName:
          payment.receivedByUser?.profile?.fullName ||
          payment.receivedByUser?.email ||
          '-',
        receivedAt: payment.receivedAt.toISOString(),
      })),
    };
  }

  private async formatInvoiceItems(invoice: any) {
    const formattedItems = invoice.items.map((item: any) => ({
      id: item.id,
      itemType: item.itemType,
      itemId: item.itemId,
      code: item.code || undefined,
      description: item.description,
      quantity: item.quantity,
      pricePerUnit: Number(item.pricePerUnit),
      subtotal: Number(item.subtotal),
      discountAmount: Number(item.discountAmount),
      totalAmount: Number(item.totalAmount),
    }));

    const shouldHydrateOpenInstallmentPrices =
      invoice.paymentPlanType === 'INSTALLMENT' &&
      invoice.status === 'PENDING_PAYMENT' &&
      Number(invoice.totalAmount || 0) === 0 &&
      formattedItems.length > 0 &&
      formattedItems.every((item: any) => Number(item.totalAmount || 0) === 0);

    if (!shouldHydrateOpenInstallmentPrices) {
      return formattedItems;
    }

    const packageIds = formattedItems
      .filter((item: any) => item.itemType === 'PACKAGE')
      .map((item: any) => item.itemId);
    const addOnIds = formattedItems
      .filter((item: any) => item.itemType === 'ADDON')
      .map((item: any) => item.itemId);

    const [packages, addOns] = await Promise.all([
      packageIds.length > 0
        ? prisma.memberPackage.findMany({
            where: { id: { in: packageIds } },
            select: { id: true, finalPrice: true, discountAmount: true },
          })
        : [],
      addOnIds.length > 0
        ? prisma.memberAddOn.findMany({
            where: { id: { in: addOnIds } },
            select: { id: true, totalPrice: true, quantity: true, pricePerUnit: true },
          })
        : [],
    ]);

    const packagePriceById = new Map(
      packages.map((pkg: any) => [
        pkg.id,
        Number(pkg.finalPrice || 0) + Number(pkg.discountAmount || 0),
      ])
    );
    const addOnPriceById = new Map(
      addOns.map((addon: any) => [
        addon.id,
        {
          totalPrice: Number(addon.totalPrice || 0),
          pricePerUnit: Number(addon.pricePerUnit || 0),
        },
      ])
    );

    return formattedItems.map((item: any) => {
      if (item.itemType === 'PACKAGE') {
        const price = packagePriceById.get(item.itemId) || 0;
        return {
          ...item,
          pricePerUnit: price,
          subtotal: price,
          totalAmount: price,
        };
      }

      if (item.itemType === 'ADDON') {
        const price = addOnPriceById.get(item.itemId);
        if (!price) return item;

        return {
          ...item,
          pricePerUnit: price.pricePerUnit,
          subtotal: price.totalPrice,
          totalAmount: price.totalPrice,
        };
      }

      return item;
    });
  }
}
