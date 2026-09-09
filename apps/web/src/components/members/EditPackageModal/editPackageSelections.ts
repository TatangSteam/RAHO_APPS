import type {
  ExtendedBoosterType,
  MemberPackage,
  PackagePricing,
  ServiceType,
} from '@/types/package';

function getBoosterTypeFromProductCode(productCode?: string | null): ExtendedBoosterType | undefined {
  const match = productCode?.match(/^BST-([^-]+)-/);
  return match?.[1] as ExtendedBoosterType | undefined;
}

function getServiceTypeFromProductCode(productCode?: string | null): ServiceType | undefined {
  const parts = productCode?.split('-') || [];
  const serviceCode = parts[0] === 'BST' ? parts[3] : parts[2];
  return serviceCode as ServiceType | undefined;
}

function resolvePackagePricing(pkg: MemberPackage, pricings: PackagePricing[]): PackagePricing | undefined {
  if (pkg.productCode) {
    const productCodeMatch = pricings.find((pricing) => pricing.productCode === pkg.productCode);
    if (productCodeMatch) return productCodeMatch;
  }

  const boosterType = getBoosterTypeFromProductCode(pkg.productCode) || pkg.boosterType;
  const serviceType = getServiceTypeFromProductCode(pkg.productCode) || pkg.serviceType;

  if (pkg.packageType === 'BOOSTER' && boosterType) {
    const boosterMatch = pricings.find((pricing) =>
      pricing.packageType === 'BOOSTER'
      && pricing.boosterType === boosterType
      && (!serviceType || pricing.serviceType === serviceType)
    );
    if (boosterMatch) return boosterMatch;
  }

  if (pkg.packageType === 'BASIC') {
    const basicMatch = pricings.find((pricing) =>
      pricing.packageType === 'BASIC'
      && (!serviceType || pricing.serviceType === serviceType)
      && (pricing.totalSessions === pkg.baseSessions || pricing.totalSessions === pkg.totalSessions)
    );
    if (basicMatch) return basicMatch;
  }

  return pricings.find((pricing) => pricing.id === pkg.packagePricingId);
}

export function buildEditPackageSelections(packages: MemberPackage[], pricings: PackagePricing[]) {
  const selections = new Map<string, {
    pricingId: string;
    quantity: number;
    boosterType?: ExtendedBoosterType;
    serviceType?: ServiceType;
  }>();

  packages.forEach((pkg) => {
    const pricing = resolvePackagePricing(pkg, pricings);
    const pricingId = pricing?.id || pkg.packagePricingId || '';
    if (!pricingId) return;

    const boosterType = (
      getBoosterTypeFromProductCode(pkg.productCode)
      || pricing?.boosterType
      || pkg.boosterType
      || undefined
    ) as ExtendedBoosterType | undefined;
    const serviceType = (
      getServiceTypeFromProductCode(pkg.productCode)
      || pricing?.serviceType
      || pkg.serviceType
      || undefined
    ) as ServiceType | undefined;
    const quantity = Math.max(1, Number(pkg.purchaseQuantity || 1));

    // The editor exposes one card per booster type. Historical used rows and
    // the active balance can point at different pricing IDs, but together
    // they represent one aggregate booster quantity.
    const key = boosterType
      ? `booster:${boosterType}`
      : ['basic', pricingId, serviceType || ''].join('|');
    const existing = selections.get(key);

    if (existing) {
      existing.quantity += quantity;
      return;
    }

    selections.set(key, { pricingId, quantity, boosterType, serviceType });
  });

  return Array.from(selections.values());
}
