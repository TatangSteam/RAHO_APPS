jest.mock('../../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '../../../lib/prisma';
import { ShipmentService } from '../shipment.service';

const findUser = prisma.user.findUnique as jest.Mock;

describe('Finance & Logistics shipment access', () => {
  const service = new ShipmentService();

  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({
      roleTemplate: { code: 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT' },
    });
  });

  it.each([
    ['receive', () => service.receiveShipment('shipment-1', 'finance-1')],
    ['review', () => service.reviewShipmentIssue('shipment-1', 'finance-1', { decision: 'CLOSE_CASE' })],
    ['edit', () => service.updateShipment('shipment-1', 'finance-1', { notes: 'changed' })],
    ['legacy receive', () => service.approveShipment('shipment-1', 'finance-1', 'branch-1')],
  ])('blocks %s because the merged account is dispatch-only', async (_label, action) => {
    await expect(action()).rejects.toMatchObject({
      status: 403,
      code: 'FINANCE_LOGISTICS_DISPATCH_ONLY',
    });
  });
});
