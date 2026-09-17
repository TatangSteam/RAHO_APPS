import { createErpAdapter } from './erp-adapter.js';

const PERIODS = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom'];
const STATUSES = ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION', 'COMPLETED', 'CANCELLED', 'OPEN'];
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const rangeFields = {
  period: { type: 'string', enum: PERIODS },
  startDate: { type: 'string', description: 'YYYY-MM-DD; wajib hanya untuk custom.' },
  endDate: { type: 'string', description: 'YYYY-MM-DD; wajib hanya untuk custom.' },
};
const range = object(rangeFields);
const definitions = [
  ['get_my_identity', 'identity', 'Nama tampilan dan identitas akun ERP yang sedang terautentikasi. Gunakan tool ini jika pengguna menanyakan nama atau akun yang sedang dipakai.', object({})],
  ['get_my_daily_performance', 'daily', 'Ringkasan task personal yang jatuh tempo hari ini dari ERP.', object({})],
  ['get_my_performance', 'performance', 'Ringkasan task personal untuk periode berdasarkan dueAt. Gunakan angka backend tanpa menghitung ulang.', range],
  ['compare_my_performance', 'compare', 'Bandingkan dua periode personal. Delta selalu A dikurangi B dan sudah dihitung ERP.', object({ periodA: range, periodB: range }, ['periodA', 'periodB'])],
  ['get_my_tasks', 'tasks', 'Daftar task personal berdasarkan dueAt dan status. OPEN berarti belum COMPLETED/CANCELLED.', object({
    ...rangeFields,
    status: { type: 'string', enum: STATUSES },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
    offset: { type: 'integer', minimum: 0, maximum: 100000 },
  })],
  ['get_my_overdue_tasks', 'overdue', 'Daftar task personal yang melewati deadline. Tanpa periode memakai 90 hari kalender terakhir.', object({
    period: { type: 'string', enum: PERIODS },
    startDate: rangeFields.startDate,
    endDate: rangeFields.endDate,
    limit: { type: 'integer', minimum: 1, maximum: 50 },
    offset: { type: 'integer', minimum: 0, maximum: 100000 },
  })],
];

const resolveBinding = (context) => {
  const full = context?.sessionKey || '';
  const key = full.startsWith('agent:') ? full.split(':').slice(2).join(':') : full;
  return /^rain-erp-[a-f0-9]{32}$/.test(key) ? { authenticated: true, sessionKey: key } : null;
};

export default {
  id: 'raho-ai',
  name: 'RAIN ERP Tools',
  register(api) {
    const baseUrl = api.pluginConfig?.baseUrl || 'http://127.0.0.1:4000';
    const timeoutMs = api.pluginConfig?.timeoutMs || 8000;
    const adapter = createErpAdapter({ baseUrl, timeoutMs, resolveIdentity: resolveBinding });

    for (const [name, operation, description, parameters] of definitions) {
      api.registerTool((toolContext) => ({
        name,
        label: name,
        description,
        parameters,
        async execute(_id, args) {
          const details = await adapter.request(operation, args || {}, toolContext);
          return {
            content: [{ type: 'text', text: JSON.stringify(details) }],
            details,
            isError: details.success !== true,
          };
        },
      }), { name, optional: true });
    }
  },
};
