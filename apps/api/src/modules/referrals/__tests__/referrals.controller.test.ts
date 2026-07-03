import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReferralsController } from '../referrals.controller';
import * as referralService from '../referrals.service';
import { sendSuccess } from '@utils/response';
import { logger } from '@lib/logger';

jest.mock('../referrals.service', () => ({
  listReferralsService: jest.fn(),
}));

jest.mock('@utils/response', () => ({
  sendSuccess: jest.fn(),
}));

jest.mock('@lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const mockReferralService = referralService as any;
const mockSendSuccess = sendSuccess as any;
const mockLogger = logger as any;

describe('ReferralsController', () => {
  const controller = new ReferralsController();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists referrals with authenticated user context', async () => {
    const result = { data: [], pagination: { total: 0 } };
    mockReferralService.listReferralsService.mockResolvedValue(result);
    const req = {
      query: { page: '1', limit: '20' },
      user: {
        id: 'user-1',
        role: 'ADMIN_CABANG',
        branchId: 'branch-1',
      },
    } as any;
    const res = {} as any;
    const next = jest.fn();

    await controller.listReferrals(req, res, next);

    expect(mockReferralService.listReferralsService).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
      'user-1',
      'ADMIN_CABANG',
      'branch-1',
    );
    expect(mockLogger.debug).toHaveBeenCalledWith('[Referrals] listReferrals request', {
      userId: 'user-1',
      userRole: 'ADMIN_CABANG',
      userBranchId: 'branch-1',
    });
    expect(mockSendSuccess).toHaveBeenCalledWith(res, result);
    expect(next).not.toHaveBeenCalled();
  });

  it('logs and forwards list referral errors', async () => {
    const error = new Error('referral failure');
    mockReferralService.listReferralsService.mockRejectedValue(error);
    const req = {
      query: {},
      user: { id: 'user-1', role: 'ADMIN_CABANG', branchId: 'branch-1' },
    } as any;
    const next = jest.fn();

    await controller.listReferrals(req, {} as any, next);

    expect(mockLogger.error).toHaveBeenCalledWith('[Referrals] listReferrals failed', { error });
    expect(next).toHaveBeenCalledWith(error);
  });
});
