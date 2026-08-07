import { logger } from '@lib/logger';

type LogContext = Record<string, unknown>;

type LogState = {
  lastLoggedAt: number;
  suppressed: number;
};

const DEFAULT_WINDOW_MS = 60_000;
const MAX_TRACKED_KEYS = 100;
const states = new Map<string, LogState>();

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * Zoho is an optional outbound integration. An ERP write must stay quiet and
 * successful while no active Zoho Books connection exists.
 */
export function isExpectedZohoUnavailable(error: unknown): boolean {
  return errorCode(error) === 'ZOHO_NOT_CONNECTED';
}

/**
 * Prevent a failing worker or best-effort outbox hook from flooding stdout.
 * The first failure is logged immediately; duplicates are summarized on the
 * next log after the throttle window.
 */
export function logZohoErrorThrottled(
  key: string,
  message: string,
  error: unknown,
  context: LogContext = {},
  windowMs = DEFAULT_WINDOW_MS,
): void {
  if (isExpectedZohoUnavailable(error)) return;

  const now = Date.now();
  const previous = states.get(key);
  if (previous && now - previous.lastLoggedAt < windowMs) {
    previous.suppressed += 1;
    return;
  }

  if (!previous && states.size >= MAX_TRACKED_KEYS) {
    const oldestKey = states.keys().next().value as string | undefined;
    if (oldestKey) states.delete(oldestKey);
  }

  logger.error(message, {
    ...context,
    error,
    suppressedDuplicates: previous?.suppressed ?? 0,
  });
  states.set(key, { lastLoggedAt: now, suppressed: 0 });
}

export function resetZohoLogThrottleForTests(): void {
  states.clear();
}
