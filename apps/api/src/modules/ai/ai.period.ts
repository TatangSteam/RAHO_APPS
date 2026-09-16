import { AppError } from '@middleware/errorHandler';
import { PeriodInput } from './ai.schema';

const DAY = 86400000;
const OFFSET = 7 * 3600000;
export const localDate = (date: Date) => new Date(date.getTime() + OFFSET).toISOString().slice(0, 10);
export const jakartaTimestamp = (date: Date) => `${new Date(date.getTime() + OFFSET).toISOString().slice(0, -1)}+07:00`;
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const invalid = () => new AppError(400, 'INVALID_ARGUMENT', 'Periode/tanggal tidak valid. Gunakan YYYY-MM-DD; rentang custom maksimal 366 hari.');
function validDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function resolvePeriod(input: PeriodInput, asOf: Date, rolling = false) {
  const today = localDate(asOf);
  let startDate = today;
  let endDate = today;
  let toDate = false;
  const type = input.period || (rolling ? 'rolling_90_days' : 'today');
  if (type !== 'custom' && (input.startDate || input.endDate)) throw invalid();
  switch (type) {
    case 'today': toDate = true; break;
    case 'yesterday': startDate = endDate = shift(today, -1); break;
    case 'this_week':
    case 'last_week': {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      const monday = shift(today, -((weekday + 6) % 7));
      startDate = type === 'this_week' ? monday : shift(monday, -7);
      endDate = type === 'this_week' ? today : shift(monday, -1);
      toDate = type === 'this_week';
      break;
    }
    case 'this_month': startDate = `${today.slice(0, 7)}-01`; toDate = true; break;
    case 'last_month':
      endDate = shift(`${today.slice(0, 7)}-01`, -1);
      startDate = `${endDate.slice(0, 7)}-01`;
      break;
    case 'rolling_90_days': startDate = shift(today, -89); toDate = true; break;
    case 'custom':
      if (!validDate(input.startDate) || !validDate(input.endDate)) throw invalid();
      startDate = input.startDate;
      endDate = input.endDate;
      break;
  }
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY) + 1;
  if (days < 1 || days > 366) throw invalid();
  return {
    period: { type, startDate, endDate, timezone: 'Asia/Jakarta' as const, days, toDate },
    start: new Date(`${startDate}T00:00:00.000+07:00`),
    endExclusive: new Date(`${shift(endDate, 1)}T00:00:00.000+07:00`),
  };
}
export const overdueDays = (dueAt: Date, asOf: Date) => Math.round((Date.parse(localDate(asOf)) - Date.parse(localDate(dueAt))) / DAY);
