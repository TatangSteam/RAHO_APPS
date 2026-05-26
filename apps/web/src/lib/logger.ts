/**
 * Development-only logger utility
 * Logs are only shown in development mode, not in production
 * 
 * Usage:
 * import { devLog, devWarn, devError } from '@/lib/logger';
 * devLog('Message', data);
 * devWarn('Warning message');
 * devError('Error message', error);
 */

const isDev = process.env.NODE_ENV === 'development';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devLog = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devWarn = (...args: any[]) => {
  if (isDev) {
    console.warn(...args);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devError = (...args: any[]) => {
  if (isDev) {
    console.error(...args);
  }
};

// Performance logging (only in dev)
export const devTime = (label: string) => {
  if (isDev) {
    console.time(label);
  }
};

export const devTimeEnd = (label: string) => {
  if (isDev) {
    console.timeEnd(label);
  }
};

// Group logging (only in dev)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devGroup = (label: string, ...args: any[]) => {
  if (isDev) {
    console.group(label);
    if (args.length > 0) {
      console.log(...args);
    }
  }
};

export const devGroupEnd = () => {
  if (isDev) {
    console.groupEnd();
  }
};

// Table logging (only in dev)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devTable = (data: any) => {
  if (isDev) {
    console.table(data);
  }
};

export default {
  log: devLog,
  warn: devWarn,
  error: devError,
  time: devTime,
  timeEnd: devTimeEnd,
  group: devGroup,
  groupEnd: devGroupEnd,
  table: devTable,
};
