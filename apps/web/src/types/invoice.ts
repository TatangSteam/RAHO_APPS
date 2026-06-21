export type InvoiceStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'DEBIT' | 'CREDIT' | 'QRIS' | 'OTHER';

export interface InvoiceItem {
  id: string;
  itemType: 'PACKAGE' | 'ADDON' | 'NON_THERAPY';
  itemId: string;
  code?: string; // Product code
  description: string;
  subDescription?: string; // Additional description
  quantity: number;
  unit?: string; // Unit of measurement
  pricePerUnit: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  proofFileUrl?: string;
  proofFileName?: string;
  proofFileSize?: number;
  proofMimeType?: string;
  receivedBy: string;
  receivedByName: string;
  receivedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  memberNo?: string; // Member number
  branchId: string;
  branchName: string;
  
  // Financial
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  discountNote?: string;
  taxPercent?: number;
  taxAmount?: number;
  totalAmount: number;
  
  // Incentive information
  incentive?: {
    totalAmount: number;
    referralCode: string;
    referrerName: string;
    referrerType: 'MEMBER' | 'STAFF' | 'EXTERNAL';
    recordCount: number;
  };
  
  // Status
  status: InvoiceStatus;
  paymentPlanType?: 'FULL_PAYMENT' | 'INSTALLMENT';
  paymentGroupId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  totalPurchaseAmount?: number;
  installmentAmount?: number;
  carryOverAmount?: number;
  creditAmount?: number;
  actualPaidAmount?: number;
  paymentVerificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  paymentRejectionReason?: string;
  isAdjustment?: boolean;
  dueDate?: string;
  paidAt?: string;
  cancelledAt?: string;
  
  // Payment
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  paymentNotes?: string;
  
  // Metadata
  notes?: string;
  createdBy: string;
  createdByName: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

export interface CreateInvoiceInput {
  memberId: string;
  items: Array<{
    itemType: 'PACKAGE' | 'ADDON' | 'NON_THERAPY';
    itemId: string;
    quantity: number;
  }>;
  discountPercent?: number;
  discountAmount?: number;
  discountNote?: string;
  taxPercent?: number;
  dueDate?: string;
  notes?: string;
}

export interface RecordPaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  notes?: string;
}
