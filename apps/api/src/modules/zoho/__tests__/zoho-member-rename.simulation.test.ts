import { IntegrationEvent, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logAudit } from '@utils/auditLog';
import { MemberUpdateService } from '../../members/services/member-update.service';
import { handleContactEvent, MEMBER_CONTACT_EVENT } from '../zoho.contact.service';
import { getActiveZohoClient } from '../zoho.client';
import { ZohoApiError } from '../zoho.error';
import { processClaimedZohoEvent, registerZohoEventHandler } from '../zoho.worker';

// Only persistence and transport are simulated. Member updates, contact
// payloads, ownership checks and worker success/retry logic are real code.
jest.mock('@lib/prisma', () => ({
  prisma: {
    member: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    userProfile: { update: jest.fn() },
    user: { update: jest.fn() },
    zohoConnection: { findFirst: jest.fn() },
    zohoEntityMapping: { findUnique: jest.fn(), update: jest.fn() },
    integrationEvent: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    zohoSyncAttempt: { aggregate: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));
jest.mock('../zoho.client', () => ({ getActiveZohoClient: jest.fn() }));
jest.mock('../zoho.go-live.service', () => ({ getZohoRuntimeGate: jest.fn() }));
jest.mock('../zoho.logging', () => ({ logZohoErrorThrottled: jest.fn() }));

const request = jest.fn();
const connection = {
  id: 'sim-connection',
  contactExternalIdFieldId: 'sim-external-id',
  contactExternalIdApiName: 'cf_raho_external_id',
  contactExternalIdIsUnique: true,
};
const mock = (value: unknown) => value as jest.Mock;

describe('Member rename -> Zoho simulation (no external writes)', () => {
  let member: {
    id: string; userId: string; memberNo: string; registrationBranchId: string;
    isActive: boolean; dateOfBirth: Date; createdAt: Date; updatedAt: Date;
    user: { email: string; isActive: boolean; profile: { fullName: string; phone: string } };
  };
  let queued: IntegrationEvent;

  beforeEach(() => {
    jest.resetAllMocks();
    member = {
      id: 'sim-member', userId: 'sim-user', memberNo: 'SIM-001',
      registrationBranchId: 'sim-branch', isActive: true,
      dateOfBirth: new Date('1990-01-15T00:00:00Z'),
      createdAt: new Date('2026-09-17T00:00:00Z'), updatedAt: new Date('2026-09-17T00:00:00Z'),
      user: { email: 'sim.member@example.test', isActive: true,
        profile: { fullName: 'Nama Lama', phone: '081234567890' } },
    };
    mock(prisma.member.findUnique).mockImplementation(async () => member);
    mock(prisma.member.findMany).mockResolvedValue([]);
    mock(prisma.userProfile.update).mockImplementation(async ({ data }) => {
      member.user.profile.fullName = data.fullName;
      return member.user.profile;
    });
    mock(prisma.$transaction).mockImplementation(async (work) => {
      if (typeof work !== 'function') return Promise.all(work);
      const previousName = member.user.profile.fullName;
      try {
        return await work(prisma);
      } catch (error) {
        member.user.profile.fullName = previousName;
        throw error;
      }
    });
    mock(prisma.zohoConnection.findFirst).mockResolvedValue(connection);
    mock(prisma.integrationEvent.findUnique).mockResolvedValue(null);
    mock(prisma.integrationEvent.upsert).mockImplementation(async ({ create }) => {
      queued = { ...create, id: 'sim-event', attempts: 1, maxAttempts: 5,
        payloadHash: null, availableAt: new Date() } as IntegrationEvent;
      return queued;
    });
    mock(prisma.zohoEntityMapping.findUnique).mockResolvedValue({
      id: 'sim-mapping', zohoEntityId: 'sim-contact', status: 'ACTIVE',
      dataOrigin: 'ERP', managementMode: 'ERP_MANAGED',
    });
    mock(prisma.zohoSyncAttempt.aggregate).mockResolvedValue({ _max: { attemptNo: null } });
    mock(prisma.zohoSyncAttempt.create).mockResolvedValue({ id: 'sim-attempt' });
    mock(getActiveZohoClient).mockResolvedValue({ connection, request });
    request.mockResolvedValue({ contact: { contact_id: 'sim-contact' } });
    registerZohoEventHandler(MEMBER_CONTACT_EVENT, handleContactEvent);
  });

  async function rename() {
    return new MemberUpdateService().updateMember(
      member.id, { fullName: ' Nama   Baru ' }, 'sim-manager', Role.ADMIN_MANAGER,
    );
  }

  it('saves the normalized name and updates the same mapped Zoho contact', async () => {
    const result = await rename();
    expect(result).toMatchObject({ id: 'sim-member', memberNo: 'SIM-001', fullName: 'Nama Baru' });
    expect(queued).toMatchObject({ eventType: MEMBER_CONTACT_EVENT, status: 'PENDING',
      payload: { contact: { contact_name: 'Nama Baru', contact_type: 'customer' } } });
    await processClaimedZohoEvent(queued, false);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/books/v3/contacts/sim-contact', {
      method: 'PUT', data: expect.objectContaining({ contact_name: 'Nama Baru' }),
    });
    expect(prisma.zohoEntityMapping.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sim-mapping' }, data: expect.objectContaining({ lastSyncedAt: expect.any(Date) }),
    }));
    expect(prisma.integrationEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PROCESSED' }),
    }));
    expect(prisma.zohoSyncAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SUCCEEDED' }),
    }));
    expect(JSON.stringify(queued.payload)).not.toMatch(/dateOfBirth|nik|diagnos|therapy/i);
  });

  it('dry-run records NO_WRITE and never calls Zoho transport', async () => {
    await rename();
    await processClaimedZohoEvent(queued, true);
    expect(request).not.toHaveBeenCalled();
    expect(getActiveZohoClient).not.toHaveBeenCalled();
    expect(prisma.zohoSyncAttempt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DRY_RUN', responseSummary: { outcome: 'NO_WRITE', mode: 'DRY_RUN' } }),
    }));
  });

  it('a temporary Zoho failure schedules retry without reverting the saved member name', async () => {
    await rename();
    request.mockRejectedValue(new ZohoApiError('Simulated unavailable', 'ZOHO_HTTP_503', 503, true));
    await processClaimedZohoEvent(queued, false);
    expect(member.user.profile.fullName).toBe('Nama Baru');
    expect(prisma.zohoSyncAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'RETRY_SCHEDULED', nextRetryAt: expect.any(Date) }),
    }));
    expect(prisma.integrationEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING', availableAt: expect.any(Date) }),
    }));
    expect(prisma.zohoEntityMapping.update).not.toHaveBeenCalled();
  });

  it('does not overwrite a manually managed Zoho contact', async () => {
    await rename();
    mock(prisma.zohoEntityMapping.findUnique).mockResolvedValue({ managementMode: 'MANUAL_ONLY' });
    await processClaimedZohoEvent(queued, false);
    expect(request).not.toHaveBeenCalled();
    expect(prisma.zohoSyncAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED', errorCode: 'ZOHO_MAPPING_REVIEW_REQUIRED' }),
    }));
  });

  it('rolls back the name when the durable outbox cannot be written', async () => {
    mock(prisma.integrationEvent.upsert).mockRejectedValue(new Error('Simulated outbox unavailable'));
    await expect(rename()).rejects.toMatchObject({ status: 503, code: 'MEMBER_SYNC_QUEUE_UNAVAILABLE' });
    expect(member.user.profile.fullName).toBe('Nama Lama');
    expect(logAudit).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('can save again after an outbox failure without needing manual Zoho enqueue', async () => {
    mock(prisma.integrationEvent.upsert).mockRejectedValueOnce(new Error('Temporary database failure'));
    await expect(rename()).rejects.toMatchObject({ code: 'MEMBER_SYNC_QUEUE_UNAVAILABLE' });
    await expect(rename()).resolves.toMatchObject({ fullName: 'Nama Baru' });
    expect(queued.status).toBe('PENDING');
    await processClaimedZohoEvent(queued, false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('still allows local name editing when no Zoho organization is connected', async () => {
    mock(prisma.zohoConnection.findFirst).mockResolvedValue(null);
    await expect(rename()).resolves.toMatchObject({ fullName: 'Nama Baru' });
    expect(queued.status).toBe('PENDING');
    expect(request).not.toHaveBeenCalled();
  });

  it('rolls back a concurrent name edit while the contact event is processing', async () => {
    mock(prisma.integrationEvent.findUnique).mockResolvedValue({ status: 'PROCESSING' });
    await expect(rename()).rejects.toMatchObject({ status: 409, code: 'ZOHO_CONTACT_SYNC_IN_PROGRESS' });
    expect(member.user.profile.fullName).toBe('Nama Lama');
    expect(prisma.integrationEvent.upsert).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
