/**
 * Shared cross-cutting types.
 *
 * This module may only import from third-party packages — never from other
 * application layers — so it can be referenced anywhere without cycles.
 */

/** Minimal structural type for `fetch`, allowing injection in tests. */
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/** Success envelope returned by `src/lib/response.ts`. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** Failure envelope returned by `src/lib/response.ts`. */
export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
