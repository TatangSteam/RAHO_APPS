export type PaymentAccountType = 'HOMECARE' | 'PARTNERSHIP' | 'CABANG';

export interface PaymentAccountDetails {
  type: PaymentAccountType;
  label: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export const PAYMENT_ACCOUNT_OPTIONS: PaymentAccountDetails[] = [
  {
    type: 'HOMECARE',
    label: 'Homecare',
    bankName: 'BCA',
    accountNumber: '087-1137888',
    accountHolder: 'Homecare',
  },
  {
    type: 'PARTNERSHIP',
    label: 'Partnership',
    bankName: 'BCA',
    accountNumber: '0870399766',
    accountHolder: 'CV DSS JAKARTA PUSAT',
  },
  {
    type: 'CABANG',
    label: 'Cabang (Botanica dan Batavia)',
    bankName: 'BCA',
    accountNumber: '0870399677',
    accountHolder: 'CV DSS Premier Bandung',
  },
];

export function getPaymentAccountByType(type?: string | null) {
  return PAYMENT_ACCOUNT_OPTIONS.find((account) => account.type === type) || PAYMENT_ACCOUNT_OPTIONS[2];
}

export function getDefaultStockRequestPaymentAccount(branchType?: string | null, branchName?: string | null) {
  const normalizedBranchName = String(branchName || '').toLowerCase();

  if (normalizedBranchName.includes('homecare')) {
    return getPaymentAccountByType('HOMECARE');
  }

  if (branchType === 'PARTNERSHIP') {
    return getPaymentAccountByType('PARTNERSHIP');
  }

  return getPaymentAccountByType('CABANG');
}

export function getDefaultInvoicePaymentAccount(invoice: {
  branchName?: string | null;
  items?: Array<{ code?: string; description?: string; subDescription?: string }>;
}) {
  const branchName = String(invoice.branchName || '').toLowerCase();
  const itemText = (invoice.items || [])
    .map((item) => `${item.code || ''} ${item.description || ''} ${item.subDescription || ''}`)
    .join(' ')
    .toLowerCase();

  if (branchName.includes('homecare') || itemText.includes('homecare') || itemText.includes('-hc')) {
    return getPaymentAccountByType('HOMECARE');
  }

  return getPaymentAccountByType('CABANG');
}

