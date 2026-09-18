const { deployWithRecovery } = require('../../../../prisma/deploy-with-recovery.cjs');

describe('portable local migration startup', () => {
  const prisma = {};
  const recover = jest.fn();
  const findFailed = jest.fn();
  const deploy = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    recover.mockResolvedValue(undefined);
    findFailed.mockResolvedValue([{ migration_name: 'known' }]);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('repairs existing failures before deploying pending migrations', async () => {
    deploy.mockResolvedValue(true);
    await deployWithRecovery(prisma, { recover, findFailed, deploy });
    expect(recover).toHaveBeenCalledWith(prisma);
    expect(recover.mock.invocationCallOrder[0]).toBeLessThan(deploy.mock.invocationCallOrder[0]);
    expect(deploy).toHaveBeenCalledTimes(1);
    expect(findFailed).not.toHaveBeenCalled();
  });
  it('recovers a newly failed migration and retries deploy', async () => {
    deploy.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await deployWithRecovery(prisma, { recover, findFailed, deploy });
    expect(recover).toHaveBeenCalledTimes(2);
    expect(deploy).toHaveBeenCalledTimes(2);
  });
  it('refuses unknown failures without running deploy', async () => {
    recover.mockRejectedValue(new Error('unrecognized failure'));
    await expect(deployWithRecovery(prisma, { recover, findFailed, deploy })).rejects.toThrow('unrecognized');
    expect(deploy).not.toHaveBeenCalled();
  });
  it('stops immediately when deploy fails without a failed migration', async () => {
    deploy.mockResolvedValue(false);
    findFailed.mockResolvedValue([]);
    await expect(deployWithRecovery(prisma, { recover, findFailed, deploy })).rejects.toThrow('without a recoverable');
    expect(recover).toHaveBeenCalledTimes(1);
    expect(deploy).toHaveBeenCalledTimes(1);
  });
  it('refuses to retry if a newly encountered migration cannot be repaired', async () => {
    deploy.mockResolvedValue(false);
    recover.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('repair rolled back'));
    await expect(deployWithRecovery(prisma, { recover, findFailed, deploy })).rejects.toThrow('repair rolled back');
    expect(deploy).toHaveBeenCalledTimes(1);
  });
  it('bounds recovery retries to three', async () => {
    deploy.mockResolvedValue(false);
    await expect(deployWithRecovery(prisma, { recover, findFailed, deploy })).rejects.toThrow('retry limit');
    expect(deploy).toHaveBeenCalledTimes(4);
    expect(recover).toHaveBeenCalledTimes(4);
  });
});
