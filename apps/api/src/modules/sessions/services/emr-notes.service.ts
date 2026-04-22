import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { CreateEMRNoteInput } from '../sessions.schema';
import { AuditAction } from '@prisma/client';

export class EMRNotesService {
  async createEMRNote(sessionId: string, data: CreateEMRNoteInput, userId: string) {
    // Check if session exists
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    // No prerequisite validation - allow EMR notes anytime
    const emrNote = await prisma.eMRNote.create({
      data: {
        treatmentSessionId: sessionId,
        noteType: data.noteType,
        content: data.content,
        writtenBy: data.writtenBy,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'EMRNote',
      resourceId: emrNote.id,
      meta: { sessionId, noteType: data.noteType },
    });

    return emrNote;
  }

  async getEMRNotes(sessionId: string) {
    const notes = await prisma.eMRNote.findMany({
      where: { treatmentSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return notes.map((n) => ({
      id: n.id,
      noteType: n.noteType,
      content: n.content,
      writtenBy: n.writtenBy,
      createdAt: n.createdAt.toISOString(),
    }));
  }
}
