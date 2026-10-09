export type ApiErrorCode =
  | 'invalid_transition'
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'opted_out'
  | 'rate_limited'
  | 'unauthorized'
  | 'forbidden'
  | 'dependency_unavailable'
  | 'internal_error';

export type ParsedApiError = {
  code: ApiErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

const KNOWN_CODES = new Set<ApiErrorCode>([
  'invalid_transition',
  'validation_error',
  'not_found',
  'conflict',
  'opted_out',
  'rate_limited',
  'unauthorized',
  'forbidden',
  'dependency_unavailable',
  'internal_error',
]);

function normalizeCode(value: unknown): ApiErrorCode {
  return typeof value === 'string' && KNOWN_CODES.has(value as ApiErrorCode)
    ? (value as ApiErrorCode)
    : 'internal_error';
}

export function parseApiError(
  payload: unknown,
  fallback: string
): ParsedApiError {
  if (!payload || typeof payload !== 'object') {
    return {
      code: 'internal_error',
      message: typeof payload === 'string' && payload.trim() ? payload : fallback,
    };
  }

  const body = payload as {
    code?: unknown;
    message?: unknown;
    error?: unknown;
    retry_after?: unknown;
  };
  const nested =
    body.error && typeof body.error === 'object'
      ? (body.error as {
          code?: unknown;
          message?: unknown;
          retry_after?: unknown;
        })
      : null;
  const message =
    (typeof nested?.message === 'string' && nested.message.trim()) ||
    (typeof body.error === 'string' && body.error.trim()) ||
    (typeof body.message === 'string' && body.message.trim()) ||
    fallback;
  const retryAfter = nested?.retry_after ?? body.retry_after;

  return {
    code: normalizeCode(nested?.code ?? body.code),
    message,
    ...(typeof retryAfter === 'number'
      ? { retryAfterSeconds: retryAfter }
      : {}),
  };
}

export function parseApiErrorText(raw: string, fallback: string) {
  if (!raw.trim()) return parseApiError(null, fallback);
  try {
    return parseApiError(JSON.parse(raw), fallback);
  } catch {
    return parseApiError(raw, fallback);
  }
}

export class ApiBoundaryError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(error: ParsedApiError, status: number) {
    super(error.message);
    this.name = 'ApiBoundaryError';
    this.code = error.code;
    this.status = status;
  }
}
