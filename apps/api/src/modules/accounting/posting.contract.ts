import { Prisma } from '@prisma/client';
import { errors } from '@middleware/errorHandler';

export type MoneyValue = string | number | Prisma.Decimal;

export interface JournalPostingLineInput {
  accountCode: string;
  debit?: MoneyValue;
  credit?: MoneyValue;
  branchId?: string;
  costCenterCode?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface JournalSourceLinkInput {
  sourceType: string;
  sourceId: string;
  sourceNumber?: string;
  relationType?: string;
  metadata?: Record<string, unknown>;
}

export interface PostJournalInput {
  postingKey: string;
  transactionDate: Date | string;
  branchId: string;
  actorUserId: string;
  description: string;
  costCenterCode?: string;
  lines: JournalPostingLineInput[];
  sourceLinks: JournalSourceLinkInput[];
  metadata?: Record<string, unknown>;
}

export interface NormalizedJournalLine {
  accountCode: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  branchId: string;
  costCenterCode?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidatedPosting {
  postingKey: string;
  transactionDate: Date;
  branchId: string;
  actorUserId: string;
  description: string;
  lines: NormalizedJournalLine[];
  sourceLinks: JournalSourceLinkInput[];
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  metadata?: Record<string, unknown>;
}

export interface PostingValidationOptions {
  allowCrossBranch?: boolean;
}

export function validateAndNormalizePosting(
  input: PostJournalInput,
  options: PostingValidationOptions = {},
): ValidatedPosting {
  const transactionDate = input.transactionDate instanceof Date
    ? input.transactionDate
    : new Date(input.transactionDate);
  if (Number.isNaN(transactionDate.getTime())) {
    throw errors.badRequest('JOURNAL_DATE_INVALID', 'Tanggal transaksi jurnal tidak valid.');
  }
  if (!input.postingKey?.trim()) {
    throw errors.badRequest('POSTING_KEY_REQUIRED', 'Posting key wajib diisi.');
  }
  if (!input.description?.trim()) {
    throw errors.badRequest('JOURNAL_DESCRIPTION_REQUIRED', 'Deskripsi jurnal wajib diisi.');
  }
  if (!input.branchId || !input.actorUserId) {
    throw errors.badRequest('JOURNAL_CONTEXT_REQUIRED', 'Branch dan actor wajib tersedia.');
  }
  if (!input.sourceLinks?.length) {
    throw errors.badRequest('JOURNAL_SOURCE_REQUIRED', 'Minimal satu source document wajib ditautkan.');
  }
  if (input.sourceLinks.some((source) => !source.sourceType?.trim() || !source.sourceId?.trim())) {
    throw errors.badRequest('JOURNAL_SOURCE_INVALID', 'Source type dan source ID wajib diisi.');
  }
  const sourceKeys = input.sourceLinks.map((source) =>
    `${source.sourceType.trim().toUpperCase()}:${source.sourceId}:${source.relationType?.trim().toUpperCase() || 'PRIMARY'}`
  );
  if (new Set(sourceKeys).size !== sourceKeys.length) {
    throw errors.badRequest('JOURNAL_SOURCE_DUPLICATE', 'Source document dalam relasi yang sama tidak boleh duplikat.');
  }
  if (!input.lines || input.lines.length < 2) {
    throw errors.badRequest('JOURNAL_LINES_INVALID', 'Jurnal minimal memiliki dua baris.');
  }

  const lines = input.lines.map((line, index): NormalizedJournalLine => {
    if (!line.accountCode?.trim()) {
      throw errors.badRequest('JOURNAL_ACCOUNT_REQUIRED', `Account code baris ${index + 1} wajib diisi.`);
    }
    const debit = new Prisma.Decimal(line.debit ?? 0);
    const credit = new Prisma.Decimal(line.credit ?? 0);
    if (debit.isNegative() || credit.isNegative()) {
      throw errors.badRequest('JOURNAL_AMOUNT_NEGATIVE', `Baris ${index + 1} memiliki nominal negatif.`);
    }
    const hasDebit = debit.greaterThan(0);
    const hasCredit = credit.greaterThan(0);
    if (hasDebit === hasCredit) {
      throw errors.badRequest('JOURNAL_LINE_SIDE_INVALID', `Baris ${index + 1} harus memiliki tepat satu sisi debit atau kredit.`);
    }
    if (debit.decimalPlaces() > 2 || credit.decimalPlaces() > 2) {
      throw errors.badRequest('JOURNAL_SCALE_INVALID', `Baris ${index + 1} maksimal memiliki dua angka desimal.`);
    }
    const branchId = line.branchId || input.branchId;
    if (branchId !== input.branchId && !options.allowCrossBranch) {
      throw errors.badRequest('JOURNAL_CROSS_BRANCH_INVALID', 'Satu journal entry hanya boleh berisi satu branch.');
    }
    return {
      ...line,
      accountCode: line.accountCode.trim().toUpperCase(),
      branchId,
      costCenterCode: line.costCenterCode || input.costCenterCode,
      debit,
      credit,
    };
  });

  const totalDebit = lines.reduce((sum, line) => sum.plus(line.debit), new Prisma.Decimal(0));
  const totalCredit = lines.reduce((sum, line) => sum.plus(line.credit), new Prisma.Decimal(0));
  if (!totalDebit.equals(totalCredit) || totalDebit.lessThanOrEqualTo(0)) {
    throw errors.unprocessable(
      'JOURNAL_NOT_BALANCED',
      `Jurnal tidak balanced. Debit ${totalDebit.toFixed(2)}, kredit ${totalCredit.toFixed(2)}.`,
    );
  }

  return {
    ...input,
    postingKey: input.postingKey.trim(),
    description: input.description.trim(),
    transactionDate,
    lines,
    totalDebit,
    totalCredit,
  };
}
