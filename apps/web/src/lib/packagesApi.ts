import { api } from './api';

export interface PackageSelection {
  pricingId: string;
  quantity: number;
  boosterType?: string; // NO, GT, MB, KCL, H2S, HK, O3
  serviceType?: string; // PM, PS, PTY, PDA, PHC
}

export interface AssignPackageData {
  packages: PackageSelection[];
  discountPercent?: number;
  discountAmount?: number;
  discountNote?: string;
  notes?: string;
}

export interface VerifyPaymentData {
  notes?: string;
  proofFileUrl: string;
  proofFileName: string;
  proofFileSize: number;
  proofMimeType: string;
}

export interface PackagePricingData {
  packageType: 'BASIC' | 'BOOSTER';
  name: string;
  totalSessions: number;
  price: number;
  description?: string;
  isActive?: boolean;
}

export const packagesApi = {
  // Upload payment proof file
  uploadPaymentProof: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/packages/payment-proof/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data || response.data;
  },

  // Assign package to member
  assignPackage: async (memberId: string, data: AssignPackageData) => {
    const response = await api.post(`/members/${memberId}/packages`, data);
    return response.data.data || response.data;
  },

  // Verify payment
  verifyPayment: async (packageId: string, data: VerifyPaymentData) => {
    const response = await api.patch(`/packages/${packageId}/verify`, data);
    return response.data.data || response.data;
  },

  // Get member packages
  getMemberPackages: async (memberId: string) => {
    // Add timestamp to prevent caching
    const response = await api.get(`/members/${memberId}/packages?_t=${Date.now()}`);
    // Backend returns array directly in data
    const packages = response.data.data || [];
    return { packages };
  },

  // Get package pricings
  getPackagePricings: async () => {
    // Add timestamp to prevent caching
    const response = await api.get(`/package-pricings?_t=${Date.now()}`);
    return response.data.data?.pricings || response.data.pricings || [];
  },

  // Create package pricing
  createPackagePricing: async (data: PackagePricingData) => {
    const response = await api.post('/package-pricings', data);
    return response.data.data || response.data;
  },

  // Update package pricing
  updatePackagePricing: async (pricingId: string, data: Partial<PackagePricingData>) => {
    const response = await api.patch(`/package-pricings/${pricingId}`, data);
    return response.data.data || response.data;
  },

  // Delete package pricing
  deletePackagePricing: async (pricingId: string) => {
    const response = await api.delete(`/package-pricings/${pricingId}`);
    return response.data.data || response.data;
  },

  // Refund package (ACTIVE → CANCELLED)
  refundPackage: async (packageId: string, data: { reason: string; refundAmount?: number }) => {
    const response = await api.post(`/packages/${packageId}/refund`, data);
    return response.data.data || response.data;
  },

  // Cancel package (PENDING_PAYMENT → CANCELLED)
  cancelPackage: async (packageId: string, data: { reason: string }) => {
    const response = await api.post(`/packages/${packageId}/cancel`, data);
    return response.data.data || response.data;
  },

  // Edit package (PENDING_PAYMENT only)
  editPackage: async (packageId: string, data: { 
    quantity?: number; 
    discount?: number; 
    discountNote?: string; 
    notes?: string;
  }) => {
    const response = await api.put(`/packages/${packageId}`, data);
    return response.data.data || response.data;
  },
};
