export interface CaughtErrorPayload {
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    [key: string]: unknown;
  };
  details?: unknown;
  data?: unknown;
  [key: string]: unknown;
}

export interface CaughtError {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
  stack?: string;
  response?: {
    status?: number;
    data?: CaughtErrorPayload;
  };
  [key: string]: unknown;
}

/**
 * Narrows values caught by JavaScript before UI code reads API error fields.
 * Throwing a non-object value again preserves the original failure instead of
 * causing a secondary "cannot read property" error in the catch block.
 */
export function assertCaughtError(error: unknown): asserts error is CaughtError {
  if ((typeof error !== 'object' && typeof error !== 'function') || error === null) {
    throw error;
  }
}
