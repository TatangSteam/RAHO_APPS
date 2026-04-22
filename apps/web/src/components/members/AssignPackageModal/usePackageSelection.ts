import { PackagePricing, ExtendedBoosterType, ServiceType, SERVICE_TYPE_PRICING, BOOSTER_TYPE_LABELS, AddOnPricing, AddOnType } from '@/types/package';

interface PackageSelection {
  pricingId: string;
  quantity: number;
  boosterType?: ExtendedBoosterType;
  serviceType?: ServiceType;
}

interface AddOnSelection {
  type: AddOnType;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

interface AssignData {
  selectedPackages: PackageSelection[];
  selectedAddOns: AddOnSelection[];
  discountPercent: number;
  discountAmount: number;
  discountNote: string;
  notes: string;
}

export function usePackageSelection(
  assignData: AssignData,
  onAssignDataChange: (data: AssignData) => void,
  pricingsList: PackagePricing[]
) {
  // ── BASIC helpers ──────────────────────────────────────────
  const isBasicSelected = (pricingId: string) =>
    assignData.selectedPackages.some(p => p.pricingId === pricingId && !p.boosterType);

  const getBasicSelection = (pricingId: string) =>
    assignData.selectedPackages.find(p => p.pricingId === pricingId && !p.boosterType);

  const toggleBasic = (pricingId: string) => {
    if (isBasicSelected(pricingId)) {
      onAssignDataChange({
        ...assignData,
        selectedPackages: assignData.selectedPackages.filter(
          p => !(p.pricingId === pricingId && !p.boosterType)
        ),
      });
    } else {
      onAssignDataChange({
        ...assignData,
        selectedPackages: [...assignData.selectedPackages, { pricingId, quantity: 1 }],
      });
    }
  };

  const updateBasicQty = (pricingId: string, quantity: number) => {
    onAssignDataChange({
      ...assignData,
      selectedPackages: assignData.selectedPackages.map(p =>
        p.pricingId === pricingId && !p.boosterType
          ? { ...p, quantity: Math.max(1, quantity) }
          : p
      ),
    });
  };

  // ── BOOSTER helpers ────────────────────────────────────────
  const isBoosterSelected = (pricingId: string, boosterType: ExtendedBoosterType) =>
    assignData.selectedPackages.some(
      p => p.pricingId === pricingId && p.boosterType === boosterType
    );

  const getBoosterSelection = (pricingId: string, boosterType: ExtendedBoosterType) =>
    assignData.selectedPackages.find(
      p => p.pricingId === pricingId && p.boosterType === boosterType
    );

  const toggleBooster = (pricingId: string, boosterType: ExtendedBoosterType) => {
    if (isBoosterSelected(pricingId, boosterType)) {
      onAssignDataChange({
        ...assignData,
        selectedPackages: assignData.selectedPackages.filter(
          p => !(p.pricingId === pricingId && p.boosterType === boosterType)
        ),
      });
    } else {
      onAssignDataChange({
        ...assignData,
        selectedPackages: [
          ...assignData.selectedPackages,
          { pricingId, quantity: 1, boosterType, serviceType: 'PM' },
        ],
      });
    }
  };

  const updateBoosterQty = (pricingId: string, boosterType: ExtendedBoosterType, quantity: number) => {
    onAssignDataChange({
      ...assignData,
      selectedPackages: assignData.selectedPackages.map(p =>
        p.pricingId === pricingId && p.boosterType === boosterType
          ? { ...p, quantity: Math.max(1, quantity) }
          : p
      ),
    });
  };

  const updateBoosterServiceType = (pricingId: string, boosterType: ExtendedBoosterType, serviceType: ServiceType) => {
    onAssignDataChange({
      ...assignData,
      selectedPackages: assignData.selectedPackages.map(p =>
        p.pricingId === pricingId && p.boosterType === boosterType
          ? { ...p, serviceType }
          : p
      ),
    });
  };

  // ── ADD-ON helpers ─────────────────────────────────────────
  const isAddOnSelected = (code: string) =>
    assignData.selectedAddOns.some(a => a.code === code);

  const getAddOnQuantity = (code: string) =>
    assignData.selectedAddOns.find(a => a.code === code)?.quantity || 1;

  const toggleAddOn = (addon: AddOnPricing) => {
    if (isAddOnSelected(addon.code)) {
      onAssignDataChange({
        ...assignData,
        selectedAddOns: assignData.selectedAddOns.filter(a => a.code !== addon.code),
      });
    } else {
      onAssignDataChange({
        ...assignData,
        selectedAddOns: [...assignData.selectedAddOns, {
          type: addon.type, code: addon.code, name: addon.name, price: addon.price, quantity: 1,
        }],
      });
    }
  };

  const updateAddOnQuantity = (code: string, quantity: number) => {
    onAssignDataChange({
      ...assignData,
      selectedAddOns: assignData.selectedAddOns.map(a =>
        a.code === code ? { ...a, quantity: Math.max(1, quantity) } : a
      ),
    });
  };

  // ── Preview calculation ────────────────────────────────────
  const calculatePreview = () => {
    let subtotal = 0;
    const items: Array<{ name: string; sessions?: number; price: number; type: string; details?: string }> = [];

    assignData.selectedPackages.forEach(selection => {
      const pricing = pricingsList.find(p => p.id === selection.pricingId);
      if (!pricing) return;

      let pricePerSession = pricing.price;
      let itemName = pricing.name;
      let details = '';
      let totalPrice = 0;

      if (pricing.packageType === 'BASIC') {
        totalPrice = pricePerSession * selection.quantity;
      } else {
        const serviceType = selection.serviceType || 'PM';
        const serviceConfig = SERVICE_TYPE_PRICING[serviceType];
        pricePerSession = serviceConfig.pricePerSession;
        const BOOSTER_TYPE_LABELS_MAP = BOOSTER_TYPE_LABELS as Record<string, string>;
        const boosterLabel = selection.boosterType ? BOOSTER_TYPE_LABELS_MAP[selection.boosterType] : 'NO';
        itemName = `Booster ${boosterLabel} ${pricing.totalSessions}X`;
        details = `${serviceConfig.name}${serviceConfig.unit ? ` (${serviceConfig.unit})` : ''}`;
        totalPrice = pricePerSession * pricing.totalSessions * selection.quantity;
      }

      subtotal += totalPrice;
      items.push({
        name: itemName,
        sessions: pricing.totalSessions * selection.quantity,
        price: totalPrice,
        type: pricing.packageType,
        details,
      });
    });

    assignData.selectedAddOns.forEach(addon => {
      const totalPrice = addon.price * addon.quantity;
      subtotal += totalPrice;
      items.push({ name: addon.name, price: totalPrice, type: 'ADDON', details: `${addon.quantity} unit` });
    });

    let discount = 0;
    if (assignData.discountPercent > 0) discount += subtotal * (Math.min(assignData.discountPercent, 100) / 100);
    if (assignData.discountAmount > 0) discount += assignData.discountAmount;
    discount = Math.min(discount, subtotal);

    return { items, subtotal, discount, total: Math.max(subtotal - discount, 0) };
  };

  return {
    isBasicSelected,
    getBasicSelection,
    toggleBasic,
    updateBasicQty,
    isBoosterSelected,
    getBoosterSelection,
    toggleBooster,
    updateBoosterQty,
    updateBoosterServiceType,
    isAddOnSelected,
    getAddOnQuantity,
    toggleAddOn,
    updateAddOnQuantity,
    calculatePreview,
  };
}
