// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for generating invoices from packages
 */
export class InvoiceGenerationService {
  /**
   * Generate invoice for packages
   */
  async generateInvoiceForPackages(packages: any[], member: any, userId: string) {
    try {
      // Get branch
      const branch = await prisma.branch.findUnique({
        where: { id: member.registrationBranchId },
        select: { branchCode: true },
      });

      if (!branch) {
        console.error('Branch not found for invoice generation');
        return;
      }

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(branch.branchCode);

      // Calculate totals
      let subtotal = 0;
      const invoiceItems: any[] = [];

      for (const pkg of packages) {
        // Use productCode if available, otherwise fallback to packageCode
        const itemCode = pkg.productCode || pkg.packageCode;
        
        // Create better description
        let itemName = '';
        if (pkg.boosterType) {
          // Booster package
          const serviceTypeLabel = pkg.serviceType === 'PM' ? 'Perawatan Mandiri' :
                                   pkg.serviceType === 'PS' ? 'Perawatan Standar' :
                                   pkg.serviceType === 'PTY' ? 'Perawatan Terapi' :
                                   pkg.serviceType === 'PDA' ? 'Perawatan Dokter' :
                                   pkg.serviceType === 'PHC' ? 'Perawatan Home Care' : pkg.serviceType;
          itemName = `Paket Booster ${pkg.boosterType} - ${pkg.totalSessions}x Sesi (${serviceTypeLabel})`;
        } else {
          // Basic package
          itemName = `Paket Terapi Dasar - ${pkg.totalSessions}x Sesi`;
        }

        // Calculate price per session and quantity
        const quantity = pkg.totalSessions;
        const pricePerUnit = Math.round(Number(pkg.finalPrice) / quantity);
        const itemSubtotal = pricePerUnit * quantity;
        
        subtotal += itemSubtotal;

        invoiceItems.push({
          itemType: 'PACKAGE',
          itemId: pkg.id,
          code: itemCode,
          description: itemName,
          quantity: quantity,
          pricePerUnit: pricePerUnit,
          subtotal: itemSubtotal,
          discountAmount: 0, // Discount already applied to finalPrice
          totalAmount: itemSubtotal,
        });
      }

      // Get total discount from first package (they share the same discount in a group)
      // Note: Discount is already applied to finalPrice, so we set these to 0 for invoice display
      const discountPercent = 0;
      const discountAmount = 0;
      const discountNote = packages[0].discountNote || undefined;

      // Create invoice
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          memberId: member.id,
          branchId: member.registrationBranchId,
          subtotal,
          discountPercent,
          discountAmount,
          discountNote,
          taxPercent: 0,
          taxAmount: 0,
          totalAmount: subtotal,
          status: 'PAID',
          paidAt: new Date(),
          paymentMethod: 'CASH',
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
          items: {
            create: invoiceItems,
          },
        },
      });

      console.log(`✅ Invoice ${invoiceNumber} generated for member ${member.memberNo}`);
    } catch (error) {
      console.error('Error generating invoice:', error);
      // Don't throw error - invoice generation is optional
    }
  }

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(branchCode: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    // Get last invoice for this branch and month
    const prefix = `INV-${branchCode}-${year}${month}`;
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
      sequence = lastSeq + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }
}
