const ROUTES = {
  daily: '/api/v1/ai/me/performance/today',
  performance: '/api/v1/ai/me/performance',
  compare: '/api/v1/ai/me/performance/compare',
  tasks: '/api/v1/ai/me/tasks',
  overdue: '/api/v1/ai/me/tasks/overdue',
};

export class RainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function queryFor(operation, args) {
  const query = new URLSearchParams();
  if (operation === 'compare') {
    for (const suffix of ['A', 'B']) {
      const range = args[`period${suffix}`];
      if (!range || typeof range !== 'object' || Array.isArray(range)) {
        throw new RainError('INVALID_ARGUMENT', `period${suffix} wajib diberikan.`);
      }
      for (const field of ['period', 'startDate', 'endDate']) {
        if (range[field] !== undefined) query.set(`${field}${suffix}`, String(range[field]));
      }
    }
    return query;
  }
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query;
}

function validateEnvelope(body) {
  if (!body || body.contractVersion !== 'rain.v1' || body.success !== true || body.source !== 'erp'
    || body.isDemo !== false || typeof body.user?.id !== 'string' || !body.user.id) {
    throw new RainError('INVALID_RESPONSE', 'Respons ERP tidak sesuai kontrak.');
  }
  if (typeof body.asOf !== 'string' || !Number.isFinite(Date.parse(body.asOf))) {
    throw new RainError('INVALID_RESPONSE', 'Waktu respons ERP tidak valid.');
  }
}

function validatePerformance(value) {
  const integerFields = ['totalTasks', 'eligibleTasks', 'unfinished', 'completed', 'inProgress', 'todo', 'submitted', 'needsRevision', 'cancelled', 'overdue'];
  if (!value || integerFields.some((key) => !Number.isInteger(value[key]) || value[key] < 0)) {
    throw new RainError('INVALID_RESPONSE', 'Metrik ERP tidak valid.');
  }
  if (value.eligibleTasks !== value.totalTasks - value.cancelled
    || value.unfinished !== value.eligibleTasks - value.completed) {
    throw new RainError('INVALID_RESPONSE', 'Metrik ERP tidak konsisten.');
  }
  if (value.completionRate !== null
    && (typeof value.completionRate !== 'number' || value.completionRate < 0 || value.completionRate > 100)) {
    throw new RainError('INVALID_RESPONSE', 'Completion rate ERP tidak valid.');
  }
}

function validateBody(operation, body) {
  validateEnvelope(body);
  if (operation === 'daily' || operation === 'performance') validatePerformance(body.performance);
  if (operation === 'compare') {
    validatePerformance(body.periodA?.performance);
    validatePerformance(body.periodB?.performance);
    if (body.comparison?.direction !== 'A_MINUS_B') {
      throw new RainError('INVALID_RESPONSE', 'Arah comparison ERP tidak valid.');
    }
  }
  if (operation === 'tasks' || operation === 'overdue') {
    if (!Array.isArray(body.tasks) || !body.pagination || !Number.isInteger(body.pagination.total)
      || !Number.isInteger(body.pagination.offset) || !Number.isInteger(body.pagination.limit)
      || body.tasks.length > body.pagination.limit) {
      throw new RainError('INVALID_RESPONSE', 'Daftar atau pagination ERP tidak valid.');
    }
    for (const task of body.tasks) {
      if (!task || typeof task.id !== 'string' || typeof task.title !== 'string' || task.title.length > 500
        || typeof task.status !== 'string' || typeof task.dueAt !== 'string') {
        throw new RainError('INVALID_RESPONSE', 'Data task ERP tidak valid.');
      }
    }
  }
  return body;
}

function mapHttpError(status) {
  if (status === 400) return new RainError('INVALID_ARGUMENT', 'Parameter ditolak ERP.');
  if (status === 401) return new RainError('UNAUTHENTICATED', 'Sesi ERP berakhir.');
  if (status === 403) return new RainError('FORBIDDEN', 'Akses data ditolak ERP.');
  if (status === 408 || status === 504) return new RainError('TIMEOUT', 'Layanan ERP melewati batas waktu.');
  return new RainError('SERVICE_UNAVAILABLE', 'Layanan ERP tidak tersedia.');
}

export function createErpAdapter({ baseUrl, resolveIdentity, fetchImpl = fetch, timeoutMs = 8000 }) {
  if (typeof baseUrl !== 'string' || typeof resolveIdentity !== 'function') {
    throw new Error('ERP base URL and identity resolver are required');
  }
  return {
    async request(operation, args = {}, context) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        if (!Object.hasOwn(ROUTES, operation)) throw new RainError('INVALID_ARGUMENT', 'Operasi tidak diizinkan.');
        const identity = await resolveIdentity(context);
        if (!identity?.authenticated || !identity.sessionKey) {
          throw new RainError('UNAUTHENTICATED', 'Sesi ERP belum terautentikasi.');
        }
        const url = new URL(ROUTES[operation], baseUrl);
        url.search = queryFor(operation, args).toString();
        const response = await fetchImpl(url, {
          method: 'GET',
          headers: { 'X-RAIN-Session-Key': identity.sessionKey, Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw mapHttpError(response.status);
        return validateBody(operation, await response.json());
      } catch (error) {
        const normalized = error instanceof RainError
          ? error
          : error instanceof Error && error.name === 'AbortError'
            ? new RainError('TIMEOUT', 'Layanan ERP melewati batas waktu.')
            : new RainError('SERVICE_UNAVAILABLE', 'Layanan ERP tidak dapat dihubungi.');
        return {
          contractVersion: 'rain.v1', success: false, source: 'erp', isDemo: false,
          error: {
            code: normalized.code,
            message: normalized.message,
            retryable: ['TIMEOUT', 'SERVICE_UNAVAILABLE'].includes(normalized.code),
          },
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
