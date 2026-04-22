// @ts-nocheck
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../utils/auditLog';
import type { AssignPackageInput, VerifyPaymentInput, CreatePackagePricingInput, UpdatePackagePricingInput } from './packages.schema';
import { PackageType, PackageStatus, AuditAction } from '@prisma/client';

export class PackagesService {
  // Generate package code
  private generatePackageCode(branchCode: string, packageType: PackageType, sequence: number): string {
    const typeCode = packageType === PackageType.BASIC ? 'BSC' : 'BST';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const sequenceStr = sequence.toString().padStart(4, '0');
    
    return `PKG-${branchCode}-${typeCode}-${year}${month}-${sequenceStr}`;
  }

  // Generate product code based on package details
  private generateProductCode(
    packageType: PackageType,
    totalSessions: number,
    serviceType?: string,
    boosterType?: string
  ): string {
    if (packageType === PackageType.BASIC) {
      // BASIC packages: TNB-P{sessions}-{serviceType}
      // e.g., TNB-P7-PM, TNB-P15-PM, TNB-P1-PS
      const sessionsCode = `P${totalSessions}`;
      const serviceCode = serviceType || 'PM';
      return `TNB-${sessionsCode}-${serviceCode}`;
    } else {
      // BOOSTER packages: BST-{boosterType}-P1-{serviceType}
      // e.g., BST-NO-P1-PM, BST-GT-P1-PS
      const boosterCode = boosterType || 'NO';
      const serviceCode = serviceType || 'PM';
      return `BST-${boosterCode}-P1-${serviceCode}`;
    }
  }

  async assignPackage(
    memberId: string,
    data: AssignPackageInput,
    branchId: string,
    userId: string
  ) {
    // Validate member access
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
        branchAccesses: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check if staff has access to this member
    const hasAccess =
      member.registrationBranchId === branchId ||
      member.branchAccesses.some((access) => access.branchId === branchId);

    if (!hasAccess) {
      throw {
        status: 403,
        code: 'MEMBER_ACCESS_DENIED',
        message: 'Anda tidak memiliki akses ke member ini',
      };
    }

    // Get branch for code generation
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // Service type pricing configuration
    const SERVICE_TYPE_PRICING: Record<string, number> = {
      PM: 1_000_000,
      PS: 650_000,
      PTY: 600_000,
      PDA: 65_000,
      PHC: 750_000,
    };

    // Fetch all pricing data (only if packages are selected)
    const pricingIds = [...new Set(data.packages.map(p => p.pricingId))]; // deduplicate
    const pricings = pricingIds.length > 0 ? await prisma.packagePricing.findMany({
      where: { id: { in: pricingIds } },
    }) : [];

    if (pricingIds.length > 0 && pricings.length !== pricingIds.length) {
      throw { status: 404, code: 'PRICING_NOT_FOUND', message: 'Beberapa harga paket tidak ditemukan' };
    }

    // Calculate total price
    let subtotal = 0;
    const packageDetails: Array<{
      pricing: any;
      quantity: number;
      boosterType?: string;
      serviceType?: string;
      pricePerSession: number;
      totalPrice: number;
    }> = [];

    console.log('Building packageDetails from data.packages...');
    data.packages.forEach((pkg, idx) => {
      console.log(`\nPackage ${idx}:`);
      console.log(`  pricingId: ${pkg.pricingId}`);
      console.log(`  quantity: ${pkg.quantity}`);
      console.log(`  boosterType: ${pkg.boosterType}`);
      console.log(`  serviceType: ${pkg.serviceType}`);
      
      const pricing = pricings.find(p => p.id === pkg.pricingId)!;
      let pricePerSession = Number(pricing.price);
      let totalPrice = 0;

      if (pricing.packageType === PackageType.BASIC) {
        // BASIC: price is already total package price (e.g., NB7HC = Rp 12,500,000 total)
        // Just multiply by quantity if buying multiple packages
        totalPrice = pricePerSession * pkg.quantity;
      } else if (pricing.packageType === PackageType.BOOSTER) {
        // BOOSTER: use service type pricing per session
        if (pkg.serviceType) {
          pricePerSession = SERVICE_TYPE_PRICING[pkg.serviceType] || pricePerSession;
        }
        // Multiply by totalSessions (always 1 for booster) and quantity
        totalPrice = pricePerSession * pricing.totalSessions * pkg.quantity;
      }

      subtotal += totalPrice;

      packageDetails.push({
        pricing,
        quantity: pkg.quantity,
        boosterType: pkg.boosterType,
        serviceType: pkg.serviceType,
        pricePerSession,
        totalPrice,
      });
      
      console.log(`  Calculated totalPrice: ${totalPrice}`);
    });
    
    console.log(`\nTotal packageDetails: ${packageDetails.length}`);
    packageDetails.forEach((detail, idx) => {
      console.log(`  Detail ${idx}: quantity=${detail.quantity}, type=${detail.pricing.packageType}, totalPrice=${detail.totalPrice}`);
    });

    // Add add-on subtotal
    const addOnSubtotal = (data.addOns || []).reduce((sum, addon) => sum + addon.price * addon.quantity, 0);
    subtotal += addOnSubtotal;

    // Calculate discount (rounded to avoid decimal issues)
    // Both percent and amount can be used together (summed)
    const percentDiscount = Math.round((subtotal * (data.discountPercent || 0)) / 100);
    const amountDiscount = Math.round(data.discountAmount || 0);
    const totalDiscountAmount = percentDiscount + amountDiscount;
    const finalTotal = Math.round(subtotal - totalDiscountAmount);

    // Determine if this is a grouped purchase (BASIC + BOOSTER together OR multiple packages of same type)
    const hasBasic = packageDetails.some(p => p.pricing.packageType === PackageType.BASIC);
    const hasBooster = packageDetails.some(p => p.pricing.packageType === PackageType.BOOSTER);
    const totalPackagesToCreate = packageDetails.reduce((sum, detail) => sum + detail.quantity, 0);
    const hasAddOns = (data.addOns || []).length > 0;
    
    // Create purchaseGroupId if:
    // 1. BASIC + BOOSTER together, OR
    // 2. Multiple packages of the same type (quantity > 1), OR
    // 3. Packages + add-ons together
    const purchaseGroupId = (hasBasic && hasBooster) || totalPackagesToCreate > 1 || (totalPackagesToCreate > 0 && hasAddOns)
      ? `GRP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
      : undefined;

    console.log(`\n=== Purchase Group Decision ===`);
    console.log(`hasBasic: ${hasBasic}`);
    console.log(`hasBooster: ${hasBooster}`);
    console.log(`totalPackagesToCreate: ${totalPackagesToCreate}`);
    console.log(`Should group: ${(hasBasic && hasBooster) || totalPackagesToCreate > 1}`);
    console.log(`purchaseGroupId: ${purchaseGroupId}`);


    console.log('=== Assign Package Calculation ===');
    console.log('Input data.packages:', JSON.stringify(data.packages, null, 2));
    console.log('packageDetails:', JSON.stringify(packageDetails.map(p => ({ quantity: p.quantity, packageType: p.pricing.packageType })), null, 2));
    console.log(`Subtotal: Rp ${subtotal.toLocaleString('id-ID')}`);
    console.log(`Discount %: ${data.discountPercent || 0}% = Rp ${percentDiscount.toLocaleString('id-ID')}`);
    console.log(`Discount Amount: Rp ${amountDiscount.toLocaleString('id-ID')}`);
    console.log(`Total Discount: Rp ${totalDiscountAmount.toLocaleString('id-ID')}`);
    console.log(`Final Total: Rp ${finalTotal.toLocaleString('id-ID')}`);

    // Get sequence for package code BEFORE transaction - separate for BASIC and BOOSTER
    const basicTypeCode = 'BSC';
    const boosterTypeCode = 'BST';
    const dateStr = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const branchPrefix = `PKG-${branch.branchCode}`;
    
    console.log(`\n=== Sequence Query Debug ===`);
    console.log(`Branch prefix: ${branchPrefix}`);
    console.log(`Date string: ${dateStr}`);
    console.log(`Looking for BASIC pattern: ${branchPrefix}-${basicTypeCode}-${dateStr}-`);
    console.log(`Looking for BOOSTER pattern: ${branchPrefix}-${boosterTypeCode}-${dateStr}-`);
    
    // Use raw SQL for reliable pattern matching - OUTSIDE transaction
    const basicPattern = `${branchPrefix}-${basicTypeCode}-${dateStr}-%`;
    const boosterPattern = `${branchPrefix}-${boosterTypeCode}-${dateStr}-%`;
    
    const lastBasicResult = await prisma.$queryRaw<any[]>`
      SELECT "packageCode" FROM "member_packages"
      WHERE "branchId" = ${branchId}
        AND "packageCode" LIKE ${basicPattern}
      ORDER BY "packageCode" DESC
      LIMIT 1
    `;
    
    const lastBoosterResult = await prisma.$queryRaw<any[]>`
      SELECT "packageCode" FROM "member_packages"
      WHERE "branchId" = ${branchId}
        AND "packageCode" LIKE ${boosterPattern}
      ORDER BY "packageCode" DESC
      LIMIT 1
    `;
    
    // Extract sequences
    let basicSequence = 1;
    if (lastBasicResult && lastBasicResult.length > 0) {
      const packageCode = lastBasicResult[0].packageCode;
      console.log(`✅ Last BASIC package found: ${packageCode}`);
      const parts = packageCode.split('-');
      const lastSequence = parseInt(parts[parts.length - 1], 10);
      basicSequence = isNaN(lastSequence) ? 1 : lastSequence + 1;
      console.log(`   Parts: ${JSON.stringify(parts)}`);
      console.log(`   Last sequence: ${lastSequence}, Next sequence: ${basicSequence}`);
    } else {
      console.log(`❌ No BASIC package found in database for this branch/date`);
    }
    
    let boosterSequence = 1;
    if (lastBoosterResult && lastBoosterResult.length > 0) {
      const packageCode = lastBoosterResult[0].packageCode;
      console.log(`✅ Last BOOSTER package found: ${packageCode}`);
      const parts = packageCode.split('-');
      const lastSequence = parseInt(parts[parts.length - 1], 10);
      boosterSequence = isNaN(lastSequence) ? 1 : lastSequence + 1;
      console.log(`   Parts: ${JSON.stringify(parts)}`);
      console.log(`   Last sequence: ${lastSequence}, Next sequence: ${boosterSequence}`);
    } else {
      console.log(`❌ No BOOSTER package found in database for this branch/date`);
    }

    console.log(`\n=== Sequence Initialization ===`);
    console.log(`Basic sequence: ${basicSequence}`);
    console.log(`Booster sequence: ${boosterSequence}`);

    // Create packages in transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdPackages: any[] = [];
      let totalBasicSessions = 0;

      try {

        // Track remaining discount to distribute
        let remainingDiscount = totalDiscountAmount;
        let packageIndex = 0;
        const totalPackages = packageDetails.reduce((sum, detail) => sum + detail.quantity, 0);

        console.log(`\n=== Starting package creation loop ===`);
        console.log(`Total packages to create: ${totalPackages}`);
        console.log(`Package details count: ${packageDetails.length}`);
        packageDetails.forEach((detail, idx) => {
          console.log(`  Detail ${idx}: quantity=${detail.quantity}, type=${detail.pricing.packageType}`);
        });

        // Track created package codes to avoid duplicates within this transaction
        const createdPackageCodes = new Set<string>();
        
        // Create each package
        for (const detail of packageDetails) {
          console.log(`\n=== Processing package detail ===`);
          console.log(`Package type: ${detail.pricing.packageType}`);
          console.log(`Quantity to create: ${detail.quantity}`);
          
          for (let i = 0; i < detail.quantity; i++) {
            console.log(`\n  Creating package ${i + 1} of ${detail.quantity}`);
            packageIndex++;
            
            // Use appropriate sequence based on package type
            let currentSequence: number;
            if (detail.pricing.packageType === PackageType.BASIC) {
              currentSequence = basicSequence++;
            } else {
              currentSequence = boosterSequence++;
            }
            
            let packageCode = this.generatePackageCode(branch.branchCode, detail.pricing.packageType, currentSequence);
            
            // Ensure packageCode is unique within this transaction
            while (createdPackageCodes.has(packageCode)) {
              console.log(`  ⚠️  packageCode ${packageCode} already exists in this transaction, incrementing...`);
              if (detail.pricing.packageType === PackageType.BASIC) {
                currentSequence = basicSequence++;
              } else {
                currentSequence = boosterSequence++;
              }
              packageCode = this.generatePackageCode(branch.branchCode, detail.pricing.packageType, currentSequence);
            }
            
            createdPackageCodes.add(packageCode);
            console.log(`  Generated packageCode: ${packageCode}`);
            
            // Calculate individual package price
            let packageSubtotal = 0;
            if (detail.pricing.packageType === PackageType.BASIC) {
              // BASIC: price is total package price
              packageSubtotal = detail.pricePerSession;
            } else {
              // BOOSTER: price per session * sessions
              packageSubtotal = detail.pricePerSession * detail.pricing.totalSessions;
            }
            
            // Distribute discount proportionally across all packages
            let packageDiscount = 0;
            if (packageIndex === totalPackages) {
              // Last package gets all remaining discount (to handle rounding)
              packageDiscount = remainingDiscount;
            } else {
              // Proportional discount based on package price
              packageDiscount = Math.round((packageSubtotal / subtotal) * totalDiscountAmount);
              remainingDiscount -= packageDiscount;
            }
            
            const packageFinalPrice = Math.round(packageSubtotal - packageDiscount);

            // Generate product code
            const productCode = this.generateProductCode(
              detail.pricing.packageType,
              detail.pricing.totalSessions,
              detail.serviceType,
              detail.boosterType
            );

            const memberPackage = await tx.memberPackage.create({
              data: {
                memberId,
                branchId,
                packageCode,
                packageType: detail.pricing.packageType,
                packagePricingId: detail.pricing.id,
                productCode,
                serviceType: detail.serviceType,
                totalSessions: detail.pricing.totalSessions,
                usedSessions: 0,
                finalPrice: packageFinalPrice,
                discountPercent: packageDiscount > 0 ? (data.discountPercent || 0) : 0,
                discountAmount: packageDiscount,
                discountNote: packageDiscount > 0 ? data.discountNote : null,
                status: PackageStatus.PENDING_PAYMENT,
                boosterType: detail.boosterType ? (detail.boosterType === 'NO' ? 'NO2' : 'HHO') : null,
                notes: data.notes,
                assignedBy: userId,
                purchaseGroupId,
              },
            });

            console.log(`✅ Created package: ${packageCode}`);
            console.log(`  - Type: ${detail.pricing.packageType}`);
            console.log(`  - Subtotal: Rp ${packageSubtotal.toLocaleString('id-ID')}`);
            console.log(`  - Discount: Rp ${packageDiscount.toLocaleString('id-ID')}`);
            console.log(`  - Final Price: Rp ${packageFinalPrice.toLocaleString('id-ID')}`);
            if (purchaseGroupId) {
              console.log(`  - Bundle Group: ${purchaseGroupId}`);
            }

            createdPackages.push({
              ...memberPackage,
              extendedBoosterType: detail.boosterType, // Store original booster type
              serviceType: detail.serviceType,
            });

            // Count basic sessions for voucher update
            if (detail.pricing.packageType === PackageType.BASIC) {
              totalBasicSessions += detail.pricing.totalSessions;
            }
          }
        }

        console.log(`\n=== Package creation complete ===`);
        console.log(`Total packages created: ${createdPackages.length}`);
        console.log(`Expected: ${totalPackages}`);

        // Update member voucher count
        if (totalBasicSessions > 0) {
          await tx.member.update({
            where: { id: memberId },
            data: { voucherCount: { increment: totalBasicSessions } },
          });
        }

        // Create add-ons
        const createdAddOns: any[] = [];
        for (const addon of (data.addOns || [])) {
          // Generate add-on code: ADO-{branchCode}-{YYYYMM}-{seq}
          const addonDateStr = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
          const addonPattern = `ADO-${branch.branchCode}-${addonDateStr}-%`;
          const lastAddon = await tx.$queryRaw<any[]>`
            SELECT "addOnCode" FROM "member_add_ons"
            WHERE "branchId" = ${branchId}
              AND "addOnCode" LIKE ${addonPattern}
            ORDER BY "addOnCode" DESC
            LIMIT 1
          `;
          let addonSeq = 1;
          if (lastAddon && lastAddon.length > 0) {
            const parts = lastAddon[0].addOnCode.split('-');
            const lastSeq = parseInt(parts[parts.length - 1], 10);
            addonSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
          }
          const addOnCode = `ADO-${branch.branchCode}-${addonDateStr}-${addonSeq.toString().padStart(4, '0')}`;

          // Map frontend type to Prisma AddOnType
          const addOnTypeMap: Record<string, string> = {
            AIR_NANO: 'AIR_NANO',
            ROKOK_KENKOU: 'LAINNYA', // ROKOK_KENKOU maps to LAINNYA in AddOnType enum
            KONSULTASI_GIZI: 'KONSULTASI_GIZI',
            KONSULTASI_PSIKOLOG: 'KONSULTASI_PSIKOLOG',
            LAINNYA: 'LAINNYA',
          };
          const prismaAddOnType = addOnTypeMap[addon.type] || 'LAINNYA';

          // Link add-on to first package if packages exist (for grouped purchases)
          const linkedPackageId = createdPackages.length > 0 ? createdPackages[0].id : null;

          const memberAddOn = await tx.memberAddOn.create({
            data: {
              addOnCode,
              memberId,
              branchId,
              packageId: linkedPackageId,
              addOnType: prismaAddOnType as any,
              quantity: addon.quantity,
              pricePerUnit: addon.price,
              totalPrice: addon.price * addon.quantity,
              status: PackageStatus.PENDING_PAYMENT,
              notes: `${addon.name} (${addon.code})${data.notes ? ' - ' + data.notes : ''}`,
              assignedBy: userId,
            },
          });

          createdAddOns.push({
            ...memberAddOn,
            originalCode: addon.code,
            originalName: addon.name,
            originalType: addon.type,
          });
        }

        return { createdPackages, createdAddOns, purchaseGroupId, totalBasicSessions };
      } catch (error) {
        console.error('Error in transaction:', error);
        throw error;
      }
    });

    // Audit log for packages
    for (const pkg of result.createdPackages) {
      await logAudit({
        userId,
        action: AuditAction.CREATE,
        resource: 'MemberPackage',
        resourceId: pkg.id,
        meta: { 
          memberId, 
          packageType: pkg.packageType, 
          totalSessions: pkg.totalSessions,
          boosterType: pkg.extendedBoosterType,
          serviceType: pkg.serviceType,
          purchaseGroupId: result.purchaseGroupId 
        },
      });
    }

    // Audit log for add-ons
    for (const addon of result.createdAddOns) {
      await logAudit({
        userId,
        action: AuditAction.CREATE,
        resource: 'MemberAddOn',
        resourceId: addon.id,
        meta: {
          memberId,
          addOnType: addon.addOnType,
          originalType: addon.originalType,
          originalCode: addon.originalCode,
          quantity: addon.quantity,
          purchaseGroupId: result.purchaseGroupId,
        },
      });
    }

    const totalItems = result.createdPackages.length + result.createdAddOns.length;
    return {
      packages: result.createdPackages,
      addOns: result.createdAddOns,
      purchaseGroupId: result.purchaseGroupId,
      totalPackages: result.createdPackages.length,
      totalAddOns: result.createdAddOns.length,
      totalBasicSessions: result.totalBasicSessions,
      message: `${totalItems} item berhasil diassign`,
    };
  }

  async verifyPayment(packageId: string, data: VerifyPaymentInput, userId: string) {
    // Try to find as package first
    const pkg = await prisma.memberPackage.findUnique({
      where: { id: packageId },
      include: { 
        member: { 
          include: { 
            user: true,
            registrationBranch: true 
          } 
        } 
      },
    });

    // If not found as package, try as add-on
    if (!pkg) {
      const addon = await prisma.memberAddOn.findUnique({
        where: { id: packageId },
        include: {
          member: {
            include: {
              user: true,
              registrationBranch: true
            }
          }
        },
      });

      if (!addon) {
        throw { status: 404, code: 'ITEM_NOT_FOUND', message: 'Paket atau add-on tidak ditemukan' };
      }

      if (addon.status !== PackageStatus.PENDING_PAYMENT) {
        throw {
          status: 422,
          code: 'ITEM_NOT_PENDING',
          message: 'Add-on tidak dalam status pending payment',
        };
      }

      const now = new Date();

      // Update add-on status with payment proof
      const updatedAddOn = await prisma.memberAddOn.update({
        where: { id: packageId },
        data: {
          status: PackageStatus.ACTIVE,
          paidAt: now,
          verifiedBy: userId,
          verifiedAt: now,
          // Store payment proof
          paymentProofUrl: data.proofFileUrl,
          paymentProofFileName: data.proofFileName,
          paymentProofFileSize: data.proofFileSize,
          paymentProofMimeType: data.proofMimeType,
        },
      });

      // Send notification
      await prisma.notification.create({
        data: {
          userId: addon.member.userId,
          type: 'INFO',
          title: 'Add-On Aktif',
          body: `Add-on Anda telah aktif ✅`,
          status: 'UNREAD',
        },
      });

      await logAudit({
        userId,
        action: AuditAction.UPDATE,
        resource: 'MemberAddOn',
        resourceId: packageId,
        meta: { action: 'VERIFY_PAYMENT', status: 'ACTIVE', proofFile: data.proofFileName },
      });

      return { addOn: updatedAddOn, message: 'Pembayaran add-on berhasil diverifikasi' };
    }

    if (pkg.status !== PackageStatus.PENDING_PAYMENT) {
      throw {
        status: 422,
        code: 'PACKAGE_NOT_PENDING',
        message: 'Paket tidak dalam status pending payment',
      };
    }

    const now = new Date();

    // If this package is part of a group, verify all packages AND add-ons in the group
    if (pkg.purchaseGroupId) {
      // Get all packages in the group
      const groupPackages = await prisma.memberPackage.findMany({
        where: { purchaseGroupId: pkg.purchaseGroupId },
      });

      const packageIds = groupPackages.map(p => p.id);

      // Get all add-ons linked to any package in the group
      const groupAddOns = await prisma.memberAddOn.findMany({
        where: { 
          packageId: { in: packageIds }
        },
      });

      // Update all packages in the group with payment proof
      await prisma.memberPackage.updateMany({
        where: { purchaseGroupId: pkg.purchaseGroupId },
        data: {
          status: PackageStatus.ACTIVE,
          paidAt: now,
          verifiedBy: userId,
          verifiedAt: now,
          activatedAt: now,
          // Store payment proof
          paymentProofUrl: data.proofFileUrl,
          paymentProofFileName: data.proofFileName,
          paymentProofFileSize: data.proofFileSize,
          paymentProofMimeType: data.proofMimeType,
        },
      });

      // Update all add-ons in the group with payment proof
      if (groupAddOns.length > 0) {
        await prisma.memberAddOn.updateMany({
          where: { 
            packageId: { in: packageIds }
          },
          data: {
            status: PackageStatus.ACTIVE,
            paidAt: now,
            verifiedBy: userId,
            verifiedAt: now,
            // Store payment proof
            paymentProofUrl: data.proofFileUrl,
            paymentProofFileName: data.proofFileName,
            paymentProofFileSize: data.proofFileSize,
            paymentProofMimeType: data.proofMimeType,
          },
        });
      }

      // Auto-generate invoice for the group
      await this.generateInvoiceForPackages(groupPackages, pkg.member, userId);

      const totalItems = groupPackages.length + groupAddOns.length;

      // Send notification to member
      await prisma.notification.create({
        data: {
          userId: pkg.member.userId,
          type: 'INFO',
          title: 'Paket Aktif',
          body: `${totalItems} item Anda telah aktif dan siap digunakan ✅`,
          status: 'UNREAD',
        },
      });

      // Audit log for each package
      for (const groupPkg of groupPackages) {
        await logAudit({
          userId,
          action: AuditAction.UPDATE,
          resource: 'MemberPackage',
          resourceId: groupPkg.id,
          meta: { action: 'VERIFY_PAYMENT_GROUP', status: 'ACTIVE', purchaseGroupId: pkg.purchaseGroupId, proofFile: data.proofFileName },
        });
      }

      // Audit log for each add-on
      for (const groupAddOn of groupAddOns) {
        await logAudit({
          userId,
          action: AuditAction.UPDATE,
          resource: 'MemberAddOn',
          resourceId: groupAddOn.id,
          meta: { action: 'VERIFY_PAYMENT_GROUP', status: 'ACTIVE', purchaseGroupId: pkg.purchaseGroupId, proofFile: data.proofFileName },
        });
      }

      return { 
        packages: groupPackages.length,
        addOns: groupAddOns.length,
        message: `${totalItems} item berhasil diverifikasi` 
      };
    }

    // Single package verification
    const updatedPackage = await prisma.memberPackage.update({
      where: { id: packageId },
      data: {
        status: PackageStatus.ACTIVE,
        paidAt: now,
        verifiedBy: userId,
        verifiedAt: now,
        // Store payment proof
        paymentProofUrl: data.proofFileUrl,
        paymentProofFileName: data.proofFileName,
        paymentProofFileSize: data.proofFileSize,
        paymentProofMimeType: data.proofMimeType,
        activatedAt: now,
        notes: data.notes || pkg.notes,
      },
    });

    // Auto-generate invoice for single package
    await this.generateInvoiceForPackages([updatedPackage], pkg.member, userId);

    // Send notification to member
    await prisma.notification.create({
      data: {
        userId: pkg.member.userId,
        type: 'INFO',
        title: 'Paket Aktif',
        body: `Paket ${pkg.packageType} Anda telah aktif dan siap digunakan ✅`,
        status: 'UNREAD',
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'MemberPackage',
      resourceId: packageId,
      meta: { action: 'VERIFY_PAYMENT', status: 'ACTIVE' },
    });

    return { package: updatedPackage, message: 'Pembayaran berhasil diverifikasi' };
  }

  // Helper method to generate invoice for packages
  private async generateInvoiceForPackages(packages: any[], member: any, userId: string) {
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

  // Helper to generate invoice number
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

  async getMemberPackages(memberId: string, branchId: string) {
    try {
      console.log('=== getMemberPackages called ===');
      console.log('memberId:', memberId);
      console.log('branchId:', branchId);
      
      // Query packages and add-ons in parallel
      const [packages, addOns] = await Promise.all([
        prisma.memberPackage.findMany({
          where: { memberId, branchId },
          include: { branch: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.memberAddOn.findMany({
          where: { memberId, branchId },
          include: { branch: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      console.log('Found packages count:', packages.length);
      console.log('Found add-ons count:', addOns.length);

      // If no packages and no add-ons, return empty array
      if (packages.length === 0 && addOns.length === 0) {
        console.log('No packages or add-ons found for this branch, returning empty array');
        return [];
      }

      // Get user info separately
      const userIds = Array.from(new Set([
        ...packages.map(p => p.assignedBy),
        ...packages.filter(p => p.verifiedBy).map(p => p.verifiedBy!),
        ...addOns.map(a => a.assignedBy),
        ...addOns.filter(a => a.verifiedBy).map(a => a.verifiedBy!),
      ]));
      
      const users = userIds.length > 0 ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        include: { profile: true },
      }) : [];

      const userMap = new Map(users.map(u => [u.id, u]));

      // Group packages by purchaseGroupId
      const grouped = new Map<string, any[]>();
      const standalone: any[] = [];

      packages.forEach((pkg) => {
        const pkgData = {
          id: pkg.id,
          packageId: pkg.id,
          packageCode: pkg.packageCode,
          productCode: pkg.productCode || undefined,
          serviceType: pkg.serviceType || undefined,
          packageType: pkg.packageType,
          totalSessions: pkg.totalSessions,
          usedSessions: pkg.usedSessions,
          remainingSessions: pkg.totalSessions - pkg.usedSessions,
          finalPrice: Number(pkg.finalPrice),
          discountPercent: pkg.discountPercent ? Number(pkg.discountPercent) : undefined,
          discountAmount: pkg.discountAmount ? Number(pkg.discountAmount) : undefined,
          discountNote: pkg.discountNote || undefined,
          notes: pkg.notes || undefined,
          status: pkg.status,
          boosterType: pkg.boosterType || undefined,
          branchName: pkg.branch.name,
          assignedBy: userMap.get(pkg.assignedBy)?.profile?.fullName || 'Unknown',
          verifiedBy: pkg.verifiedBy ? userMap.get(pkg.verifiedBy)?.profile?.fullName : undefined,
          paidAt: pkg.paidAt?.toISOString() || undefined,
          activatedAt: pkg.activatedAt?.toISOString() || undefined,
          createdAt: pkg.createdAt.toISOString(),
          purchaseGroupId: pkg.purchaseGroupId,
          upgradedFromId: pkg.upgradedFromId,
        };

        if (pkg.purchaseGroupId) {
          if (!grouped.has(pkg.purchaseGroupId)) {
            grouped.set(pkg.purchaseGroupId, []);
          }
          grouped.get(pkg.purchaseGroupId)!.push(pkgData);
        } else {
          standalone.push(pkgData);
        }
      });

      // Process add-ons - they can be grouped or standalone
      addOns.forEach((addon) => {
        const addonData = {
          id: addon.id,
          addOnId: addon.id,
          addOnCode: addon.addOnCode,
          addOnType: addon.addOnType,
          quantity: addon.quantity,
          pricePerUnit: Number(addon.pricePerUnit),
          totalPrice: Number(addon.totalPrice),
          status: addon.status,
          notes: addon.notes || undefined,
          branchName: addon.branch.name,
          assignedBy: userMap.get(addon.assignedBy)?.profile?.fullName || 'Unknown',
          verifiedBy: addon.verifiedBy ? userMap.get(addon.verifiedBy)?.profile?.fullName : undefined,
          paidAt: addon.paidAt?.toISOString() || undefined,
          verifiedAt: addon.verifiedAt?.toISOString() || undefined,
          createdAt: addon.createdAt.toISOString(),
          isAddOn: true, // Flag to identify add-ons
        };

        // If add-on has packageId, try to find its group
        if (addon.packageId) {
          const pkg = packages.find(p => p.id === addon.packageId);
          if (pkg?.purchaseGroupId) {
            if (!grouped.has(pkg.purchaseGroupId)) {
              grouped.set(pkg.purchaseGroupId, []);
            }
            grouped.get(pkg.purchaseGroupId)!.push(addonData);
          } else {
            standalone.push(addonData);
          }
        } else {
          standalone.push(addonData);
        }
      });

      // Convert grouped packages to array format
      const groupedPackages = Array.from(grouped.values()).map(group => {
        const basics = group.filter(p => !p.isAddOn && p.packageType === 'BASIC');
        const boosters = group.filter(p => !p.isAddOn && p.packageType === 'BOOSTER');
        const groupAddOns = group.filter(p => p.isAddOn);
        
        return {
          isGroup: true,
          purchaseGroupId: group[0]?.purchaseGroupId,
          basics,
          boosters,
          addOns: groupAddOns,
          basic: basics[0],
          booster: boosters[0],
          status: basics[0]?.status || boosters[0]?.status || groupAddOns[0]?.status,
          createdAt: basics[0]?.createdAt || boosters[0]?.createdAt || groupAddOns[0]?.createdAt,
        };
      });

      // Combine grouped and standalone packages/add-ons
      return [...groupedPackages, ...standalone.map(p => ({ isGroup: false, ...p }))];
    } catch (error) {
      console.error('getMemberPackages service error:', error);
      throw error;
    }
  }

  // Package Pricing CRUD
  async getPackagePricings(branchId: string) {
    try {
      const pricings = await prisma.packagePricing.findMany({
        where: { branchId },
        orderBy: [{ packageType: 'asc' }, { totalSessions: 'asc' }],
      });

      return pricings.map(p => ({
        id: p.id,
        branchId: p.branchId,
        packageType: p.packageType,
        name: p.name,
        totalSessions: p.totalSessions,
        price: Number(p.price),
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error('getPackagePricings service error:', error);
      throw error;
    }
  }

  // Get all package pricings from all branches (for ADMIN_MANAGER monitoring)
  async getAllPackagePricings() {
    try {
      const pricings = await prisma.packagePricing.findMany({
        include: {
          branch: {
            select: {
              id: true,
              branchCode: true,
              name: true,
            },
          },
        },
        orderBy: [
          { branchId: 'asc' },
          { packageType: 'asc' },
          { totalSessions: 'asc' },
        ],
      });

      return pricings.map(p => ({
        id: p.id,
        branchId: p.branchId,
        branchCode: p.branch.branchCode,
        branchName: p.branch.name,
        packageType: p.packageType,
        name: p.name,
        totalSessions: p.totalSessions,
        price: Number(p.price),
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error('getAllPackagePricings service error:', error);
      throw error;
    }
  }

  async createPackagePricing(data: CreatePackagePricingInput, branchId: string, userId: string) {
    // Check for duplicate
    const existing = await prisma.packagePricing.findFirst({
      where: {
        branchId,
        packageType: data.packageType,
        totalSessions: data.totalSessions,
      },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'PRICING_DUPLICATE',
        message: 'Harga paket dengan tipe dan jumlah sesi ini sudah ada',
      };
    }

    const pricing = await prisma.packagePricing.create({
      data: {
        ...data,
        branchId,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'PackagePricing',
      resourceId: pricing.id,
      meta: { packageType: data.packageType, totalSessions: data.totalSessions },
    });

    return {
      ...pricing,
      price: Number(pricing.price)
    };
  }

  async updatePackagePricing(pricingId: string, data: UpdatePackagePricingInput, userId: string) {
    const pricing = await prisma.packagePricing.update({
      where: { id: pricingId },
      data,
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'PackagePricing',
      resourceId: pricingId,
      meta: data,
    });

    return {
      ...pricing,
      price: Number(pricing.price)
    };
  }

  async deletePackagePricing(pricingId: string, userId: string) {
    await prisma.packagePricing.delete({
      where: { id: pricingId },
    });

    await logAudit({
      userId,
      action: AuditAction.DELETE,
      resource: 'PackagePricing',
      resourceId: pricingId,
      meta: {},
    });

    return { message: 'Harga paket berhasil dihapus' };
  }
}
