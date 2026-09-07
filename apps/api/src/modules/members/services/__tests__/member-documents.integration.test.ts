import { randomUUID } from 'node:crypto';
import { BranchType, DocumentType, Role } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { downloadFile, extractKeyFromUrl } from '../../../../config/minio';
import { MemberDocumentsService } from '../member-documents.service';

const describeDatabase = process.env.RUN_MEMBER_DOCUMENT_DB_TESTS === 'true'
  ? describe
  : describe.skip;

function uploadedFile(
  originalname: string,
  mimetype: string,
  buffer: Buffer,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
  };
}

describeDatabase('member informed-consent upload PostgreSQL + MinIO integration', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 16);
  const branchId = `consent_branch_${runId}`;
  const actorId = `consent_actor_${runId}`;
  const memberUserId = `consent_user_${runId}`;
  const memberId = `consent_member_${runId}`;
  const service = new MemberDocumentsService();

  beforeAll(async () => {
    await prisma.branch.create({
      data: {
        id: branchId,
        branchCode: `IC${runId.slice(0, 8)}`,
        name: `Consent integration ${runId}`,
        type: BranchType.PREMIER,
      },
    });
    await prisma.user.create({
      data: {
        id: actorId,
        email: `consent-actor-${runId}@example.test`,
        password: 'test-only',
        role: Role.SUPER_ADMIN,
      },
    });
    await prisma.user.create({
      data: {
        id: memberUserId,
        email: `consent-member-${runId}@example.test`,
        password: 'test-only',
        role: Role.MEMBER,
      },
    });
    await prisma.member.create({
      data: {
        id: memberId,
        userId: memberUserId,
        memberNo: `IC-${runId}`,
        registrationBranchId: branchId,
      },
    });
  });

  afterAll(async () => {
    const documents = await prisma.memberDocument.findMany({ where: { memberId } });
    for (const document of documents) {
      await service.deleteDocument(document.id, actorId);
    }
    await prisma.auditLog.deleteMany({
      where: { OR: [{ userId: actorId }, { branchId }] },
    });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await prisma.user.deleteMany({ where: { id: { in: [memberUserId, actorId] } } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  it('uploads, retrieves, and safely replaces one informed-consent document', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const firstDocument = await service.uploadDocument(
      memberId,
      DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
      uploadedFile('consent.png', 'image/png', png),
      actorId,
    );
    const firstKey = extractKeyFromUrl(firstDocument.fileUrl);
    expect((await downloadFile(firstKey)).length).toBeGreaterThan(0);

    const pdf = Buffer.from('%PDF-1.4\n% informed consent integration test\n%%EOF\n');
    const replacement = await service.uploadDocument(
      memberId,
      DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
      uploadedFile('consent-revised.pdf', 'application/pdf', pdf),
      actorId,
    );

    expect(replacement.id).toBe(firstDocument.id);
    expect(replacement.mimeType).toBe('application/pdf');
    expect(await downloadFile(extractKeyFromUrl(replacement.fileUrl))).toEqual(pdf);
    await expect(downloadFile(firstKey)).rejects.toBeDefined();
    expect(await prisma.memberDocument.count({
      where: {
        memberId,
        documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
      },
    })).toBe(1);
  }, 30_000);
});
