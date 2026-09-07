import { DocumentType } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { logAudit } from '../../../../utils/auditLog';
import {
  deleteFileByUrl,
  safeDeleteFile,
  uploadFile,
} from '../../../../config/minio';
import { processFile } from '../../../../utils/imageProcessor';
import { MemberDocumentsService } from '../member-documents.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    member: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../../config/minio', () => ({
  uploadFile: jest.fn(),
  safeDeleteFile: jest.fn(),
  deleteFileByUrl: jest.fn(),
}));

jest.mock('../../../../utils/imageProcessor', () => ({
  processFile: jest.fn(),
}));

jest.mock('../../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

const validPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'consent.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: validPng.length,
    buffer: validPng,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('MemberDocumentsService', () => {
  const transactionClient = {
    $executeRaw: jest.fn(),
    memberDocument: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const storedDocument = {
    id: 'document-1',
    memberId: 'member-1',
    documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
    fileUrl: 'http://minio/raho/new-consent.jpg',
    fileName: 'consent.png',
    fileSize: 4,
    mimeType: 'image/jpeg',
    uploadedBy: 'staff-1',
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      registrationBranchId: 'branch-1',
    });
    (processFile as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('jpeg'),
      mimeType: 'image/jpeg',
    });
    (uploadFile as jest.Mock).mockResolvedValue({
      key: 'uploads/members/member-1/documents/new-consent.jpg',
      url: storedDocument.fileUrl,
      presignedUrl: 'signed-url',
    });
    (safeDeleteFile as jest.Mock).mockResolvedValue(true);
    (deleteFileByUrl as jest.Mock).mockResolvedValue(true);
    transactionClient.$executeRaw.mockResolvedValue(1);
    transactionClient.memberDocument.findUnique.mockResolvedValue(null);
    transactionClient.memberDocument.upsert.mockResolvedValue(storedDocument);
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient),
    );
    (logAudit as jest.Mock).mockResolvedValue(undefined);
  });

  it('uploads and stores one informed-consent document', async () => {
    const result = await new MemberDocumentsService().uploadDocument(
      'member-1',
      DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
      makeFile(),
      'staff-1',
    );

    expect(result).toEqual(storedDocument);
    expect(transactionClient.memberDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberId_documentType: {
            memberId: 'member-1',
            documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
          },
        },
      }),
    );
    expect(deleteFileByUrl).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        resourceId: 'document-1',
      }),
    );
  });

  it('commits the replacement before deleting the previous object', async () => {
    transactionClient.memberDocument.findUnique.mockResolvedValue({
      ...storedDocument,
      fileUrl: 'http://minio/raho/old-consent.pdf',
    });

    await new MemberDocumentsService().uploadDocument(
      'member-1',
      DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
      makeFile(),
      'staff-1',
    );

    expect(deleteFileByUrl).toHaveBeenCalledWith('http://minio/raho/old-consent.pdf');
    expect(transactionClient.memberDocument.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      (deleteFileByUrl as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE' }),
    );
  });

  it('removes the new object when the database update fails', async () => {
    transactionClient.memberDocument.findUnique.mockResolvedValue({
      ...storedDocument,
      fileUrl: 'http://minio/raho/old-consent.pdf',
    });
    transactionClient.memberDocument.upsert.mockRejectedValue(new Error('database unavailable'));

    await expect(
      new MemberDocumentsService().uploadDocument(
        'member-1',
        DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
        makeFile(),
        'staff-1',
      ),
    ).rejects.toThrow('database unavailable');

    expect(safeDeleteFile).toHaveBeenCalledWith(
      'uploads/members/member-1/documents/new-consent.jpg',
    );
    expect(deleteFileByUrl).not.toHaveBeenCalled();
  });

  it('rejects a spoofed PDF before uploading it', async () => {
    const invalidPdf = makeFile({
      originalname: 'consent.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('not a pdf'),
      size: 9,
    });

    await expect(
      new MemberDocumentsService().uploadDocument(
        'member-1',
        DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
        invalidPdf,
        'staff-1',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_DOCUMENT_CONTENT', status: 400 });

    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('returns a retryable service error when object storage is unavailable', async () => {
    (uploadFile as jest.Mock).mockRejectedValue(new Error('storage unavailable'));

    await expect(
      new MemberDocumentsService().uploadDocument(
        'member-1',
        DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
        makeFile(),
        'staff-1',
      ),
    ).rejects.toMatchObject({ code: 'DOCUMENT_STORAGE_UNAVAILABLE', status: 503 });
  });
});
