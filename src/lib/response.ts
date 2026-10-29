import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';

/**
 * Structured API response helpers. Every route must return the same envelope:
 *   { success: true, data }                          on success
 *   { success: false, error: { code, message, ... } } on failure
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status },
  );
}

/**
 * Map an unknown thrown value into a structured failure response.
 * `AppError` subclasses carry their own `code` and `statusCode`.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.statusCode);
  }

  console.error('[vibelift] Unhandled error:', error);
  return fail('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
}
