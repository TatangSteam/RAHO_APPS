import { randomUUID } from 'crypto';
import { prisma } from '@lib/prisma';
import { enqueueContact, previewContact, SUPPLIER_CONTACT_EVENT } from '../zoho.contact.service';

const describeDatabase = process.env.RUN_ZOHO_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Zoho Sprint 3 contact database integration', () => {
  const suffix = randomUUID().slice(0, 8);
  const supplierId = `zoho-contact-${suffix}`;
  let actorId = '';

  beforeAll(async () => {
    const actor = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!actor) throw new Error('Test membutuhkan satu user aktif.');
    actorId = actor.id;
    await prisma.supplier.create({
      data: {
        id: supplierId,
        code: `ZCT-${suffix}`.toUpperCase(),
        name: `Zoho Contact Test ${suffix}`,
        taxId: `TAX-${suffix}`,
        email: `zoho-${suffix}@example.test`,
        phone: '0800000000',
        address: 'Alamat UAT',
        paymentTermsDays: 30,
        createdBy: actorId,
      },
    });
  });

  afterAll(async () => {
    await prisma.integrationEvent.deleteMany({
      where: { eventType: SUPPLIER_CONTACT_EVENT, aggregateId: supplierId },
    });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.$disconnect();
  });

  it('creates one replay-safe vendor event with non-clinical payload', async () => {
    const first = await enqueueContact('SUPPLIER', supplierId);
    const second = await enqueueContact('SUPPLIER', supplierId);
    expect(second.id).toBe(first.id);
    expect(await prisma.integrationEvent.count({
      where: { eventType: SUPPLIER_CONTACT_EVENT, aggregateId: supplierId },
    })).toBe(1);
    const payload = JSON.stringify(second.payload);
    expect(payload).toContain('"contact_type":"vendor"');
    expect(payload).not.toMatch(/diagnos|therapy|medical|birth|nik/i);
  });

  it('returns an auditable preview and explicit excluded fields', async () => {
    const preview = await previewContact('SUPPLIER', supplierId);
    expect(preview.snapshot.externalKey).toBe(`RAHO:SUPPLIER:${supplierId}`);
    expect(preview.excludedFields).toContain('diagnoses');
    expect(preview.payload).toMatchObject({ contact_type: 'vendor', payment_terms: 30 });
  });
});
