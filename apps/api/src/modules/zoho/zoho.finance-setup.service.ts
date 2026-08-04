import { AccountType } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getActiveZohoClient } from './zoho.client';
import { runDiscovery } from './zoho.discovery.service';
import { saveExpenseAccountMapping } from './zoho.expense.service';
import { saveCashBankMapping, savePaymentMethodMapping } from './zoho.payment.service';
import { saveGlAccountMapping } from './zoho.retainer.service';

type ZohoAccount = {
  account_id?: string;
  account_name?: string;
  account_code?: string;
  account_type?: string;
};

type DesiredAccount = {
  localCode: string;
  zohoName: string;
  zohoType: string;
  aliases?: string[];
};

const PAYMENT_MODE_BY_METHOD = {
  CASH: 'cash',
  TRANSFER: 'banktransfer',
  DEBIT: 'creditcard',
  CREDIT: 'creditcard',
  QRIS: 'others',
  OTHER: 'others',
} as const;

const RETAINER_ALIASES: Record<string, string[]> = {
  '2200': ['Unearned Revenue'],
  '4100': ['Sales'],
};

const EXPENSE_ALIASES: Record<string, string[]> = {
  '5100': ['Cost of Goods Sold'],
};

function normalized(value?: string | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function accountType(type: AccountType): string {
  switch (type) {
    case AccountType.LIABILITY: return 'other_current_liability';
    case AccountType.REVENUE: return 'income';
    case AccountType.EXPENSE: return 'expense';
    case AccountType.EQUITY: return 'equity';
    default: return 'other_current_asset';
  }
}

function compatible(actual: string | undefined, expected: string): boolean {
  const value = normalized(actual);
  if (value === expected) return true;
  if (expected === 'expense') return ['expense', 'other_expense', 'cost_of_goods_sold'].includes(value);
  if (expected === 'income') return ['income', 'other_income'].includes(value);
  if (expected === 'other_current_liability') return ['other_current_liability', 'other_liability'].includes(value);
  return false;
}

function findAccount(accounts: ZohoAccount[], desired: DesiredAccount): ZohoAccount | undefined {
  const byCode = accounts.find((account) =>
    normalized(account.account_code) === normalized(desired.localCode)
    && compatible(account.account_type, desired.zohoType));
  if (byCode) return byCode;
  const names = [desired.zohoName, ...(desired.aliases || [])].map(normalized);
  return accounts.find((account) =>
    names.includes(normalized(account.account_name))
    && compatible(account.account_type, desired.zohoType));
}

async function createMissingAccounts(desiredAccounts: DesiredAccount[]): Promise<string[]> {
  const client = await getActiveZohoClient(true);
  const accounts = await client.listAll<ZohoAccount>('/books/v3/chartofaccounts', 'chartofaccounts');
  const created: string[] = [];
  for (const desired of desiredAccounts) {
    if (findAccount(accounts, desired)) continue;
    const response = await client.request<{ chart_of_account?: ZohoAccount; account?: ZohoAccount }>(
      '/books/v3/chartofaccounts',
      {
        method: 'POST',
        data: {
          account_name: desired.zohoName,
          account_code: desired.localCode,
          account_type: desired.zohoType,
          description: `Dikelola otomatis oleh RAHO ERP untuk akun ${desired.localCode}.`,
        },
      },
    );
    const createdAccount = response.chart_of_account || response.account;
    accounts.push(createdAccount || {
      account_name: desired.zohoName,
      account_code: desired.localCode,
      account_type: desired.zohoType,
    });
    created.push(desired.localCode);
  }
  return created;
}

export async function ensureFinanceMappings(actorUserId: string) {
  const [cashAccounts, valuations, expenseAccounts] = await Promise.all([
    prisma.cashBankAccount.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.packageBenefitValuation.findMany({
      select: { deferredRevenueAccountCode: true, revenueAccountCode: true },
    }),
    prisma.account.findMany({
      where: { type: AccountType.EXPENSE, isActive: true, allowPosting: true },
      orderBy: { code: 'asc' },
    }),
  ]);
  const retainerCodes = [...new Set(valuations.flatMap((row) => [
    row.deferredRevenueAccountCode,
    row.revenueAccountCode,
  ]))];
  const retainerAccounts = await prisma.account.findMany({
    where: { code: { in: retainerCodes }, isActive: true, allowPosting: true },
    orderBy: { code: 'asc' },
  });
  if (retainerAccounts.length !== retainerCodes.length) {
    throw new AppError(422, 'ZOHO_LOCAL_GL_ACCOUNT_INCOMPLETE', 'Akun pendapatan paket ERP belum lengkap atau tidak aktif.');
  }

  const desiredCash: DesiredAccount[] = cashAccounts.map((account) => ({
    localCode: account.code,
    zohoName: account.name,
    zohoType: 'cash',
  }));
  const desiredRetainer: DesiredAccount[] = retainerAccounts.map((account) => ({
    localCode: account.code,
    zohoName: `RAHO ${account.code} - ${account.name}`,
    zohoType: accountType(account.type),
    aliases: RETAINER_ALIASES[account.code],
  }));
  const desiredExpense: DesiredAccount[] = expenseAccounts.map((account) => ({
    localCode: account.code,
    zohoName: `RAHO ${account.code} - ${account.name}`,
    zohoType: accountType(account.type),
    aliases: EXPENSE_ALIASES[account.code],
  }));
  const desired = [...desiredCash, ...desiredRetainer, ...desiredExpense];
  const createdAccountCodes = await createMissingAccounts(desired);

  await runDiscovery();
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const discovery = await prisma.zohoDiscoveryCache.findMany({
    where: {
      zohoConnectionId: connection.id,
      resourceType: { in: ['ACCOUNT', 'BANK_ACCOUNT'] },
      isActive: true,
    },
  });

  const locate = (entry: DesiredAccount, resourceType: 'ACCOUNT' | 'BANK_ACCOUNT') => {
    const candidates = discovery
      .filter((item) => item.resourceType === resourceType)
      .map((item) => ({
        account_id: item.zohoId,
        account_name: item.name,
        account_code: item.code || undefined,
        account_type: String((item.payload as Record<string, unknown>)?.account_type || ''),
      }));
    const result = findAccount(candidates, entry);
    if (!result?.account_id) {
      throw new AppError(502, 'ZOHO_FINANCE_ACCOUNT_NOT_DISCOVERED', `Akun Zoho untuk ${entry.localCode} belum ditemukan setelah setup.`);
    }
    return result.account_id;
  };

  for (const entry of desiredCash) {
    const local = cashAccounts.find((account) => account.code === entry.localCode)!;
    await saveCashBankMapping(actorUserId, local.id, locate(entry, 'BANK_ACCOUNT'));
  }
  for (const entry of desiredRetainer) {
    await saveGlAccountMapping(entry.localCode, locate(entry, 'ACCOUNT'));
  }
  for (const entry of desiredExpense) {
    await saveExpenseAccountMapping(entry.localCode, locate(entry, 'ACCOUNT'));
  }
  for (const [method, mode] of Object.entries(PAYMENT_MODE_BY_METHOD)) {
    await savePaymentMethodMapping(actorUserId, method, mode);
  }

  return {
    createdAccountCodes,
    cashAccountMappings: desiredCash.length,
    retainerAccountMappings: desiredRetainer.length,
    expenseAccountMappings: desiredExpense.length,
    paymentMethodMappings: Object.keys(PAYMENT_MODE_BY_METHOD).length,
  };
}
