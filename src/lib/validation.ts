import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

/**
 * Validate `unknown` data against a Zod schema and return the typed result,
 * throwing a `ValidationError` with a readable, structured message on failure.
 *
 * Use this for every external/API boundary (response payloads, route inputs).
 */
export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new ValidationError(`Invalid ${context}: ${message}`, result.error.issues);
  }
  return result.data;
}
