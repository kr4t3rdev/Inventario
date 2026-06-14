/**
 * @description Helper utilities to standardize JSON API responses.
 */

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * @description Returns a JSON success response.
 * @param {T} data - Payload to serialize.
 * @param {number} status - HTTP status code.
 * @returns {Response} JSON response.
 */
export function successResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/**
 * @description Returns a JSON error response.
 * @param {string} error - Human-readable error message.
 * @param {number} status - HTTP status code.
 * @param {string} code - Optional machine-readable error code.
 * @param {unknown} details - Optional structured details.
 * @returns {Response} JSON response.
 */
export function errorResponse(
  error: string,
  status: number,
  code?: string,
  details?: unknown,
): Response {
  const body: ApiErrorBody = { error };
  if (code) body.code = code;
  if (details !== undefined) body.details = details;
  return Response.json(body, { status });
}
