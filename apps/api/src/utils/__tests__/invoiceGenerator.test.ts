import { prisma } from '@lib/prisma';
import { generateInvoiceNumber } from '../invoiceGenerator';

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'TEST1',
}));

jest.mock('@lib/prisma', () => ({
  prisma: {
    invoice: {
      findFirst: jest.fn(),
    },
  },
}));

const prismaMock = prisma as any;
const july2026 = new Date(2026, 6, 3, 12, 0, 0);

describe('generateInvoiceNumber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts at one for a branch in a new month', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    await expect(generateInvoiceNumber('317101', july2026)).resolves.toBe(
      '00001-317101-07-2026'
    );
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith({
      where: {
        invoiceNumber: { endsWith: '-317101-07-2026' },
      },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
  });

  it('increments the latest five-digit sequence', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      invoiceNumber: '00041-317101-07-2026',
    });

    await expect(generateInvoiceNumber('317101', july2026)).resolves.toBe(
      '00042-317101-07-2026'
    );
  });
});
