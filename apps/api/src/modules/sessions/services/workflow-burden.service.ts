import { prisma } from '@lib/prisma';

type WorkflowMetrics = {
  startedAt?: string;
  activeSeconds?: number;
  stepSeconds?: Record<string, number>;
  stepTransitions?: number;
  validationErrors?: number;
  retryCount?: number;
  deviceClass?: string;
};

const STEP_LABELS: Record<string, string> = {
  '1': 'Diagnosis',
  '2': 'Therapy plan',
  '3': 'Vital sebelum',
  '4': 'Infus aktual',
  '5': 'Material',
  '6': 'Foto',
  '7': 'Vital sesudah',
  '8': 'Keluhan & rekomendasi',
  '9': 'Evaluasi dokter',
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export class WorkflowBurdenService {
  async getReport(input: { branchId?: string; dateFrom: Date; dateTo: Date }) {
    const logs = await prisma.auditLog.findMany({
      where: {
        resource: 'SessionWorkflowBurden',
        branchId: input.branchId,
        createdAt: { gte: input.dateFrom, lte: input.dateTo },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        resourceId: true,
        userId: true,
        userRole: true,
        branchId: true,
        branchName: true,
        afterData: true,
        createdAt: true,
      },
    });

    // Metrics are cumulative per user visit. Keep the newest snapshot per
    // session/user so frequent autosaves do not inflate the report.
    const latest = new Map<string, typeof logs[number]>();
    for (const log of logs) {
      const key = `${log.resourceId}:${log.userId || log.userRole || 'unknown'}`;
      if (!latest.has(key)) latest.set(key, log);
    }

    const samples = Array.from(latest.values()).map((log) => {
      const afterData = asRecord(log.afterData);
      const metrics = asRecord(afterData.metrics) as WorkflowMetrics;
      return {
        sessionId: log.resourceId,
        userRole: log.userRole || 'UNKNOWN',
        branchId: log.branchId,
        branchName: log.branchName,
        recordedAt: log.createdAt.toISOString(),
        activeSeconds: Number(metrics.activeSeconds || 0),
        stepSeconds: asRecord(metrics.stepSeconds) as Record<string, number>,
        stepTransitions: Number(metrics.stepTransitions || 0),
        validationErrors: Number(metrics.validationErrors || 0),
        retryCount: Number(metrics.retryCount || 0),
        deviceClass: metrics.deviceClass || 'UNKNOWN',
      };
    });

    const average = (values: number[]) => values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;
    const group = <T extends string>(values: T[]) => Array.from(new Set(values));

    const roles = group(samples.map((sample) => sample.userRole)).map((role) => {
      const roleSamples = samples.filter((sample) => sample.userRole === role);
      return {
        role,
        samples: roleSamples.length,
        averageActiveSeconds: average(roleSamples.map((sample) => sample.activeSeconds)),
        validationErrors: roleSamples.reduce((sum, sample) => sum + sample.validationErrors, 0),
        completionRetries: roleSamples.reduce((sum, sample) => sum + sample.retryCount, 0),
      };
    });

    const steps = Object.entries(STEP_LABELS).map(([step, label]) => {
      const durations = samples
        .map((sample) => Number(sample.stepSeconds[step] || 0))
        .filter((duration) => duration > 0);
      return { step: Number(step), label, samples: durations.length, averageSeconds: average(durations) };
    });

    return {
      period: { dateFrom: input.dateFrom.toISOString(), dateTo: input.dateTo.toISOString() },
      summary: {
        samples: samples.length,
        uniqueSessions: new Set(samples.map((sample) => sample.sessionId)).size,
        averageActiveSeconds: average(samples.map((sample) => sample.activeSeconds)),
        validationErrors: samples.reduce((sum, sample) => sum + sample.validationErrors, 0),
        completionRetries: samples.reduce((sum, sample) => sum + sample.retryCount, 0),
        underThreeMinutes: samples.filter((sample) => sample.activeSeconds > 0 && sample.activeSeconds <= 180).length,
      },
      roles,
      steps,
      samples: samples.slice(0, 100),
    };
  }
}
