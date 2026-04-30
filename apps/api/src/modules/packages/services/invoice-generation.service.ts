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

      // Calculate totals and create items
      let subtotal = 0;
      const finalInvoiceItems: any[] = [];

      // Get payment proof from first package (all packages in group have same proof)
      const firstPackage = packages[0];
      const paymentProofUrl = firstPackage.paymentProofUrl;
      const paymentProofFileName = firstPackage.paymentProofFileName;
      const paymentProofFileSize = firstPackage.paymentProofFileSize;
      const paymentProofMimeType = firstPackage.paymentProofMimeType;

      // Process packages - create separate item for EACH package to maintain itemId link
      for (const pkg of packages) {
        // Use productCode if available, otherwise fallback to packageCode
        const itemCode = pkg.productCode || pkg.packageCode;
        
        // Create better description
        let itemName = '';
        if (pkg.boosterType) {
          // Booster package - map database enum to display name
          const boosterTypeLabel = pkg.boosterType === 'NO2' ? 'NO' : 
                                   pkg.boosterType === 'HHO' ? 'HHO' : 
                                   pkg.boosterType;
          const serviceTypeLabel = pkg.serviceType === 'PM' ? 'Perawatan Mandiri' :
                                   pkg.serviceType === 'PS' ? 'Perawatan Standar' :
                                   pkg.serviceType === 'PTY' ? 'Perawatan Terapi' :
                                   pkg.serviceType === 'PDA' ? 'Perawatan Dokter' :
                                   pkg.serviceType === 'PHC' ? 'Perawatan Home Care' : pkg.serviceType;
          itemName = `Paket Booster ${boosterTypeLabel} - ${pkg.totalSessions}x Sesi (${serviceTypeLabel})`;
        } else {
          // Basic package
          itemName = `Paket Terapi Dasar - ${pkg.totalSessions}x Sesi`;
        }

        // Price per unit = original price BEFORE discount
        // We need to calculate back from finalPrice + discountAmount
        const packageDiscountAmount = Number(pkg.discountAmount || 0);
        const originalPricePerUnit = Number(pkg.finalPrice) + packageDiscountAmount;
        
        // Create separate item for each package (no grouping for packages)
        finalInvoiceItems.push({
          itemType: 'PACKAGE',
          itemId: pkg.id, // Each package gets its own item with unique itemId
          code: itemCode,
          description: itemName,
          quantity: 1,
          pricePerUnit: originalPricePerUnit, // Original price before discount
          subtotal: originalPricePerUnit,
          discountAmount: 0, // Individual item discount = 0, will be applied at invoice level
          totalAmount: originalPricePerUnit,
        });
        
        // Add original price to subtotal (before discount)
        subtotal += originalPricePerUnit;
      }

      // Query addons linked to these packages
      const packageIds = packages.map(p => p.id);
      
      // Try to find addons by packageId
      let addOns = await prisma.memberAddOn.findMany({
        where: {
          packageId: { in: packageIds },
          status: 'ACTIVE', // Only include active addons
        },
      });

      console.log(`Found ${addOns.length} addons by packageId for invoice`);

      // If no addons found by packageId, try by memberId and purchaseGroupId
      if (addOns.length === 0 && packages.length > 0 && packages[0].purchaseGroupId) {
        // Get all packages in the same purchase group
        const groupPackages = await prisma.memberPackage.findMany({
          where: { purchaseGroupId: packages[0].purchaseGroupId },
          select: { id: true },
        });
        
        const groupPackageIds = groupPackages.map(p => p.id);
        
        addOns = await prisma.memberAddOn.findMany({
          where: {
            packageId: { in: groupPackageIds },
            status: 'ACTIVE',
          },
        });
        console.log(`Found ${addOns.length} addons by purchaseGroupId for invoice`);
      }

      // Process addons - group by type and price
      const itemsMap = new Map<string, any>();
      for (const addon of addOns) {
        const addOnTypeLabel = addon.addOnType === 'AIR_NANO' ? 'Air Nano' :
                               addon.addOnType === 'KONSULTASI_GIZI' ? 'Konsultasi Gizi' :
                               addon.addOnType === 'KONSULTASI_PSIKOLOG' ? 'Konsultasi Psikolog' :
                               addon.addOnType === 'LAINNYA' ? 'Lainnya' : addon.addOnType;
        
        const itemName = `Add-On: ${addOnTypeLabel}`;
        const pricePerUnit = Number(addon.pricePerUnit);
        const quantity = addon.quantity;
        
        // Create unique key for grouping
        const itemKey = `ADDON|${itemName}|${pricePerUnit}`;
        
        if (itemsMap.has(itemKey)) {
          // Item already exists, add quantity
          const existingItem = itemsMap.get(itemKey);
          existingItem.quantity += quantity;
          existingItem.subtotal += pricePerUnit * quantity;
          existingItem.totalAmount += pricePerUnit * quantity;
        } else {
          // New item
          const itemSubtotal = pricePerUnit * quantity;
          const newItem = {
            itemType: 'ADDON',
            itemId: addon.id,
            code: addon.addOnCode,
            description: itemName,
            quantity: quantity,
            pricePerUnit: pricePerUnit,
            subtotal: itemSubtotal,
            discountAmount: 0,
            totalAmount: itemSubtotal,
          };
          itemsMap.set(itemKey, newItem);
        }
        
        subtotal += pricePerUnit * quantity;
      }

      // Add grouped addons to final items array
      finalInvoiceItems.push(...Array.from(itemsMap.values()));

      // Get discount from packages - sum all package discounts
      // Each package has proportional discount, we need to sum them all
      let totalPackageDiscount = 0;
      let discountPercent = 0;
      let discountNote: string | undefined = undefined;
      
      for (const pkg of packages) {
        totalPackageDiscount += Number(pkg.discountAmount || 0);
        if (pkg.discountPercent && pkg.discountPercent > 0) {
          discountPercent = Number(pkg.discountPercent);
        }
        if (pkg.discountNote && !discountNote) {
          discountNote = pkg.discountNote;
        }
      }

      // Subtotal is already BEFORE discount (original prices)
      const subtotalBeforeDiscount = subtotal;
      
      // Use the summed discount from all packages
      const discountAmount = totalPackageDiscount;
      const totalAmount = subtotalBeforeDiscount - discountAmount;

      console.log(`Invoice calculation:`);
      console.log(`  Subtotal (before discount): ${subtotalBeforeDiscount}`);
      console.log(`  Discount: ${discountAmount} (${discountPercent}%)`);
      console.log(`  Total: ${totalAmount}`);
      console.log(`  Items count: ${finalInvoiceItems.length} (${finalInvoiceItems.filter(i => i.itemType === 'PACKAGE').length} packages, ${finalInvoiceItems.filter(i => i.itemType === 'ADDON').length} addons)`);
      console.log(`  Payment proof: ${paymentProofFileName || 'none'}`);

      // Create invoice with payment record
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          memberId: member.id,
          branchId: member.registrationBranchId,
          subtotal: subtotalBeforeDiscount,
          discountPercent,
          discountAmount,
          discountNote,
          taxPercent: 0,
          taxAmount: 0,
          totalAmount,
          status: 'PAID',
          paidAt: new Date(),
          paymentMethod: 'CASH',
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
          items: {
            create: finalInvoiceItems,
          },
        },
      });

      // Create payment record with proof if available
      if (paymentProofUrl) {
        await prisma.invoicePayment.create({
          data: {
            invoiceId: invoice.id,
            amount: totalAmount,
            paymentMethod: 'TRANSFER', // Assuming transfer since there's proof
            proofFileUrl: paymentProofUrl,
            proofFileName: paymentProofFileName,
            proofFileSize: paymentProofFileSize,
            proofMimeType: paymentProofMimeType,
            receivedBy: userId,
            receivedAt: new Date(),
          },
        });
        console.log(`✅ Payment record created with proof: ${paymentProofFileName}`);
      }

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
