export type PackageType = 'BASIC' | 'BOOSTER';
export type PackageStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type BoosterType = 'HHO' | 'NO2';

// Extended booster types from official pricing
export type ExtendedBoosterType = 'NO' | 'GT' | 'MB' | 'KCL' | 'H2S' | 'HK' | 'O3' | 'HHO' | 'NO2';

// Service types for pricing
export type ServiceType = 'PM' | 'PS' | 'PTY' | 'PDA' | 'PHC';

// Service type pricing configuration
export const SERVICE_TYPE_PRICING: Record<ServiceType, { name: string; pricePerSession: number; unit?: string }> = {
  PM: { name: 'Premiere', pricePerSession: 1_000_000 },
  PS: { name: 'Partnership', pricePerSession: 650_000 },
  PTY: { name: 'Partnership Attiya', pricePerSession: 600_000 },
  PDA: { name: 'Partnership Dr. Abhi', pricePerSession: 65_000, unit: 'ml' },
  PHC: { name: 'Partnership Homecare', pricePerSession: 750_000 },
};

// Booster type labels
export const BOOSTER_TYPE_LABELS: Record<ExtendedBoosterType, string> = {
  NO: 'NO',
  GT: 'GT',
  MB: 'MB',
  KCL: 'KCL',
  H2S: 'H2S',
  HK: 'H2S Konsentrat',
  O3: 'O3',
  HHO: 'HHO (Legacy)',
  NO2: 'NO2 (Legacy)',
};

export interface PackagePricing {
  id: string;
  branchId: string;
  branchCode?: string;
  branchName?: string;
  packageType: PackageType;
  name: string;
  totalSessions: number;
  price: number;
  isActive: boolean;
  boosterType?: ExtendedBoosterType | null;
  serviceType?: ServiceType | null;
  productCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberPackage {
  packageId: string;
  packageCode: string;
  packagePricingId?: string; // For editing packages
  baseSessions?: number; // Base sessions from pricing
  purchaseQuantity?: number; // Calculated quantity (totalSessions / baseSessions)
  productCode?: string;
  packageType: PackageType;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  price?: number;
  finalPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  discountNote?: string;
  notes?: string;
  status: PackageStatus;
  boosterType?: BoosterType;
  serviceType?: string;
  branchName?: string;
  assignedBy: string;
  verifiedBy?: string;
  paidAt?: string;
  activatedAt?: string;
  createdAt: string;
  purchaseGroupId?: string;
  upgradedFromId?: string;
  // Payment proof
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  paymentProofFileSize?: number;
  paymentProofMimeType?: string;
  // Refund fields
  refundAmount?: number;
  refundReason?: string;
  refundProofUrl?: string;
  refundProofFileName?: string;
  refundProofFileSize?: number;
  refundProofMimeType?: string;
  refundedBy?: string;
  refundedAt?: string;
  // Incentive information
  incentive?: {
    incentiveAmount: number;
    incentiveType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    incentiveValue: number;
    referralCode: {
      code: string;
      referrerName: string;
      referrerType: 'MEMBER' | 'STAFF' | 'EXTERNAL';
    } | null;
    createdAt: string;
  };
}

export interface GroupedPackage {
  isGroup: true;
  purchaseGroupId: string;
  basic?: MemberPackage;
  booster?: MemberPackage;
  basics?: MemberPackage[];
  boosters?: MemberPackage[];
  addOns?: any[]; // Add-ons in the group
  status: PackageStatus;
  createdAt: string;
}

export interface StandalonePackage extends MemberPackage {
  isGroup: false;
}

export interface StandaloneAddOn {
  isGroup: false;
  isAddOn: true;
  id: string;
  addOnId: string;
  addOnCode: string;
  addOnType: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  status: PackageStatus;
  notes?: string;
  branchName: string;
  assignedBy: string;
  verifiedBy?: string;
  paidAt?: string;
  verifiedAt?: string;
  createdAt: string;
  // Payment proof
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  paymentProofFileSize?: number;
  paymentProofMimeType?: string;
}

export type PackageDisplay = GroupedPackage | StandalonePackage | StandaloneAddOn;

// Add-On Types
export type AddOnType = 'AIR_NANO' | 'ROKOK_KENKOU' | 'KONSULTASI_GIZI' | 'KONSULTASI_PSIKOLOG' | 'LAINNYA';

export type AirNanoColor = 'KUNING' | 'BIRU' | 'HIJAU';
export type AirNanoVolume = 'ML_600' | 'ML_1500';
export type AirNanoUnit = 'BOTOL' | 'DUS';

export interface AddOnPricing {
  type: AddOnType;
  name: string;
  code: string;
  price: number;
  // Air Nano specific
  color?: AirNanoColor;
  volume?: AirNanoVolume;
  unit?: AirNanoUnit;
}

// Air Nano Pricing Configuration
export const AIR_NANO_PRICING: AddOnPricing[] = [
  // 600ml Botol
  { type: 'AIR_NANO', name: 'Air Nano Kuning 600ml 1 Botol', code: 'ARN-CK-V06-BT', price: 15000, color: 'KUNING', volume: 'ML_600', unit: 'BOTOL' },
  { type: 'AIR_NANO', name: 'Air Nano Biru 600ml 1 Botol', code: 'ARN-CB-V06-BT', price: 15000, color: 'BIRU', volume: 'ML_600', unit: 'BOTOL' },
  { type: 'AIR_NANO', name: 'Air Nano Hijau H2S 600ml 1 Botol', code: 'ARN-CH-V06-BT', price: 15000, color: 'HIJAU', volume: 'ML_600', unit: 'BOTOL' },
  // 1500ml Botol
  { type: 'AIR_NANO', name: 'Air Nano Kuning 1500ml 1 Botol', code: 'ARN-CK-V15-BT', price: 35000, color: 'KUNING', volume: 'ML_1500', unit: 'BOTOL' },
  { type: 'AIR_NANO', name: 'Air Nano Biru 1500ml 1 Botol', code: 'ARN-CB-V15-BT', price: 35000, color: 'BIRU', volume: 'ML_1500', unit: 'BOTOL' },
  { type: 'AIR_NANO', name: 'Air Nano Hijau H2S 1500ml 1 Botol', code: 'ARN-CH-V15-BT', price: 35000, color: 'HIJAU', volume: 'ML_1500', unit: 'BOTOL' },
  // 600ml Dus
  { type: 'AIR_NANO', name: 'Air Nano Kuning 600ml 1 Dus', code: 'ARN-CK-V06-DS', price: 360000, color: 'KUNING', volume: 'ML_600', unit: 'DUS' },
  { type: 'AIR_NANO', name: 'Air Nano Biru 600ml 1 Dus', code: 'ARN-CB-V06-DS', price: 360000, color: 'BIRU', volume: 'ML_600', unit: 'DUS' },
  { type: 'AIR_NANO', name: 'Air Nano Hijau H2S 600ml 1 Dus', code: 'ARN-CH-V06-DS', price: 360000, color: 'HIJAU', volume: 'ML_600', unit: 'DUS' },
  // 1500ml Dus
  { type: 'AIR_NANO', name: 'Air Nano Kuning 1500ml 1 Dus', code: 'ARN-CK-V15-DS', price: 420000, color: 'KUNING', volume: 'ML_1500', unit: 'DUS' },
  { type: 'AIR_NANO', name: 'Air Nano Biru 1500ml 1 Dus', code: 'ARN-CB-V15-DS', price: 420000, color: 'BIRU', volume: 'ML_1500', unit: 'DUS' },
  { type: 'AIR_NANO', name: 'Air Nano Hijau H2S 1500ml 1 Dus', code: 'ARN-CH-V15-DS', price: 420000, color: 'HIJAU', volume: 'ML_1500', unit: 'DUS' },
];

export const ROKOK_KENKOU_PRICING: AddOnPricing = {
  type: 'ROKOK_KENKOU',
  name: 'Rokok Kenkou 1 Bungkus',
  code: 'RKK-KK-BK',
  price: 20000
};

export const OTHER_ADDONS_PRICING: AddOnPricing[] = [
  { type: 'KONSULTASI_GIZI', name: 'Konsultasi Gizi', code: 'KG-001', price: 0 }, // Price TBD
  { type: 'KONSULTASI_PSIKOLOG', name: 'Konsultasi Psikolog', code: 'KP-001', price: 0 }, // Price TBD
  { type: 'LAINNYA', name: 'Lainnya', code: 'LAIN-001', price: 0 }, // Price TBD
];
