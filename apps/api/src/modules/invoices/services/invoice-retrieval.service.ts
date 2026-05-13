// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { extractKeyFromUrl, s3Client } from '../../../config/minio';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../../config/env';
import { Readable } from 'stream';
import { Role } from '@prisma/client';

/**
 * Service for invoice retrieval
 */
export class InvoiceRetrievalService {
  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
      include: {
        member: {
          include: {
            referralCode: true,
          },
        },
        branch: true,
        createdByUser: true,
        verifiedByUser: true,
        items: true,
        payments: {
          include: {
            receivedByUser: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return this.formatInvoice(invoice);
  }

  /**
   * Get invoice by package ID
   */
  async getInvoiceByPackageId(packageId: string) {
    const invoice = await (prisma as any).invoice.findFirst({
      where: {
        items: {
          some: {
            itemType: 'PACKAGE',
            itemId: packageId,
          },
        },
      },
      include: {
        member: {
          include: {
            referralCode: true,
          },
        },
        branch: true,
        createdByUser: true,
        verifiedByUser: true,
        items: true,
        payments: {
          include: {
            receivedByUser: true,
          },
        },
      },
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
      include: {
        member: {
          include: {
            referralCode: true,
          },
        },
        branch: true,
        createdByUser: true,
        verifiedByUser: true,
        items: true,
        payments: {
          include: {
            receivedByUser: true,
          },
        },
      },
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
      contentType: response.ContentType || 'application/octet-stream',
      contentLength: response.ContentLength || 0,
      etag: response.ETag || '',
      fileName: payment.proofFileName,
      mimeType: payment.proofMimeType,
    };
  }

  /**
   * Format invoice for API response
   */
  async formatInvoice(invoice: any) {
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
    
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: invoice.memberId,
      memberName: invoice.member.fullName,
      memberNo: invoice.member.memberNo,
      branchId: invoice.branchId,
      branchName: invoice.branch.name,
      
      // Financial
      subtotal: Number(invoice.subtotal),
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
      dueDate: invoice.dueDate?.toISOString(),
      paidAt: invoice.paidAt?.toISOString(),
      cancelledAt: invoice.cancelledAt?.toISOString(),
      
      // Metadata
      notes: invoice.notes || undefined,
      createdBy: invoice.createdBy,
      createdByName: invoice.createdByUser.fullName,
      verifiedBy: invoice.verifiedBy || undefined,
      verifiedByName: invoice.verifiedByUser?.fullName,
      verifiedAt: invoice.verifiedAt?.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      
      // Relations
      items: invoice.items.map((item: any) => ({
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
      })),
      payments: invoice.payments.map((payment: any) => ({
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
        receivedByName: payment.receivedByUser.fullName,
        receivedAt: payment.receivedAt.toISOString(),
      })),
    };
  }
}
