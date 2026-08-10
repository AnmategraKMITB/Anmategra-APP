export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Standard error response shape for the REST (non-tRPC) import endpoints
 * under src/app/api/lembaga/**, so FE can generalize error handling across
 * all four Excel import routes instead of hardcoding per-endpoint shapes.
 */
export function apiError(
  status: number,
  error: string,
  code: ApiErrorCode,
  details?: unknown,
) {
  return Response.json(
    details === undefined ? { error, code } : { error, code, details },
    { status },
  );
}
