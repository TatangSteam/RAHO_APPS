import { prisma } from '../../../../lib/prisma';
import { MemberDocumentsService } from '../member-documents.service';
import { MemberRegistrationService } from '../member-registration.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    member: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../../../../config/minio', () => ({
  uploadFile: jest.fn(),
  safeDeleteFile: jest.fn(),
  deleteFileByUrl: jest.fn(),
}));

jest.mock('../../../../utils/imageProcessor', () => ({
  processFile: jest.fn(),
}));

jest.mock('../../../zoho/zoho.contact.service', () => ({
  enqueueContactSafely: jest.fn(),
}));

const prismaMock = prisma as any;

const registrationData = {
  fullName: 'Budi Santoso',
  identityType: 'NIK',
  nik: '3174010101010001',
  birthDate: '1990-01-15',
  phone: '081234567890',
  memberUsername: 'budi.santoso',
  memberPassword: 'password123',
} as const;

describe('MemberRegistrationService duplicate checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.branch.findUnique.mockResolvedValue({
      id: 'branch-1',
      branchCode: 'PST',
    });
    prismaMock.member.findFirst.mockResolvedValue(null);
  });

  it('rejects an NIK that is already registered globally', async () => {
    prismaMock.member.findUnique.mockImplementation(({ where }: any) => (
      where.nik ? { id: 'existing-member' } : null
    ));

    await expect(
      new MemberRegistrationService().createMember(
        registrationData,
        {},
        'branch-1',
        'admin-1',
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'NIK_EXISTS',
    });

    expect(prismaMock.member.findMany).not.toHaveBeenCalled();
  });

  it('rejects the same normalized name on the same birth date', async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);
    prismaMock.member.findMany.mockResolvedValue([
      {
        user: {
          profile: { fullName: '  BUDI   SANTOSO ' },
        },
      },
    ]);

    await expect(
      new MemberRegistrationService().createMember(
        registrationData,
        {},
        'branch-1',
        'admin-1',
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'MEMBER_NAME_BIRTH_DATE_EXISTS',
    });

    expect(prismaMock.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dateOfBirth: new Date('1990-01-15T00:00:00.000Z') },
      }),
    );
  });

  it('returns an explicit warning when a selected informed-consent file fails to upload', async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);
    prismaMock.member.findMany.mockResolvedValue([]);
    prismaMock.member.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'member-user-1',
          email: registrationData.memberUsername,
          profile: { fullName: registrationData.fullName },
        }),
      },
      member: {
        create: jest.fn().mockResolvedValue({
          id: 'member-1',
          userId: 'member-user-1',
          memberNo: 'MBR-PST-2609-0001',
        }),
      },
    }));
    prismaMock.notification.create.mockResolvedValue({ id: 'notification-1' });
    jest.spyOn(MemberDocumentsService.prototype, 'uploadDocument').mockRejectedValueOnce(
      new Error('storage unavailable'),
    );

    const result = await new MemberRegistrationService().createMember(
      registrationData,
      {
        psp: {
          fieldname: 'psp',
          originalname: 'consent.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 9,
          buffer: Buffer.from('%PDF-test'),
          stream: undefined as never,
          destination: '',
          filename: '',
          path: '',
        },
      },
      'branch-1',
      'admin-1',
    );

    expect(result.uploadedDocuments.informedConsent).toBe(false);
    expect(result.uploadWarnings).toEqual([
      'Member berhasil dibuat, tetapi informed consent gagal diunggah. Silakan unggah ulang dari detail member.',
    ]);
    expect(result.message).toContain('peringatan upload dokumen');
  });
});
