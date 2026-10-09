export type ApiErrorCode =
  | 'invalid_transition'
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'unauthorized'
  | 'forbidden'
  | 'dependency_unavailable'
  | 'internal_error';

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  headers: Headers,
  details?: unknown
) {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    }),
    { status, headers }
  );
}
