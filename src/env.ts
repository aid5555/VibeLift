import { z } from 'zod';
import { EnvValidationError } from '@/lib/errors';

/**
 * Environment contract for VibeLift.
 *
 * All process.env access is centralized here. Feature code must use `getEnv()`
 * (or `parseEnv()` in tests) instead of reading `process.env` directly.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL must be a non-empty string.')
    .default('file:/data/vibelift.db'),

  LYFTA_API_KEY: z
    .string()
    .min(1, 'LYFTA_API_KEY is required and must be a non-empty string.'),

  LYFTA_BASE_URL: z
    .string()
    .url('LYFTA_BASE_URL must be a valid URL.')
    .default('https://api.lyfta.com'),

  AI_API_KEY: z
    .string()
    .min(1, 'AI_API_KEY is required and must be a non-empty string.'),

  AI_MODEL: z.string().min(1).default('gpt-4o-mini'),

  OPENCODE_BASE_URL: z
    .string()
    .url('OPENCODE_BASE_URL must be a valid URL.')
    .default('http://localhost:8787'),

  PHOTO_STORAGE_PATH: z
    .string()
    .min(1, 'PHOTO_STORAGE_PATH must be a non-empty string.')
    .default('/data/photos'),

  MAX_PHOTO_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
});

export type Env = z.infer<typeof envSchema>;

export type EnvSource = Record<string, string | undefined>;

function formatIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

/**
 * Validate an environment source and return a fully-typed `Env`.
 * Throws `EnvValidationError` with a readable message when keys are missing
 * or malformed.
 */
export function parseEnv(source: EnvSource = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      `Invalid environment configuration:\n${formatIssues(result.error.issues)}`,
    );
  }
  return result.data;
}

let cachedEnv: Env | null = null;

/**
 * Returns the validated environment, memoizing the result for the process
 * lifetime. Use this in application code; use `parseEnv` in tests.
 */
export function getEnv(): Env {
  if (cachedEnv === null) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

/** Clears the memoized env — exposed for tests. */
export function resetEnvCache(): void {
  cachedEnv = null;
}
