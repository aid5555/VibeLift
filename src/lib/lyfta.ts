import { z } from 'zod';
import { ExternalApiError } from '@/lib/errors';
import type { FetchLike } from '@/types';

/**
 * Base Lyfta API client — the only place that talks to the Lyfta HTTP API.
 * Domain logic lives in `src/services/lyftaService.ts`; this module defines the
 * transport, configuration, and Zod-validated domain types.
 */

export interface LyftaConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export type LyftaQueryParam = string | number | boolean | undefined;

export interface LyftaClient {
  get(path: string, params?: Record<string, LyftaQueryParam>): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Domain types (Zod-validated at the response boundary)
// ---------------------------------------------------------------------------

export const lyftaWorkoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  durationMinutes: z.number().int().positive(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
});
export type LyftaWorkout = z.infer<typeof lyftaWorkoutSchema>;

export const lyftaExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscleGroup: z.string(),
  instructions: z.string(),
});
export type LyftaExercise = z.infer<typeof lyftaExerciseSchema>;

export const lyftaNutritionPlanSchema = z.object({
  id: z.string(),
  dailyCalories: z.number().int().positive(),
  meals: z.array(
    z.object({
      name: z.string(),
      calories: z.number().int().nonnegative(),
    }),
  ),
});
export type LyftaNutritionPlan = z.infer<typeof lyftaNutritionPlanSchema>;

export const lyftaWorkoutLogSchema = z.object({
  id: z.string(),
  workoutId: z.string(),
  completedAt: z.string(),
});
export type LyftaWorkoutLog = z.infer<typeof lyftaWorkoutLogSchema>;

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createLyftaClient(
  config: LyftaConfig,
  fetchImpl: FetchLike = fetch,
): LyftaClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const timeoutMs = config.timeoutMs ?? 15000;

  async function request(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          ...init.headers,
        },
        signal: controller.signal,
      });
    } catch (error) {
      throw new ExternalApiError(
        `Lyfta API request failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new ExternalApiError(
        `Lyfta API responded with ${response.status}`,
        response.status,
        { cause: bodyText },
      );
    }

    if (response.status === 204) {
      return undefined;
    }

    return response.json() as unknown;
  }

  function buildPath(
    path: string,
    params?: Record<string, LyftaQueryParam>,
  ): string {
    if (!params) {
      return path;
    }
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return `${url.pathname}${url.search}`;
  }

  return {
    async get(path, params): Promise<unknown> {
      return request(buildPath(path, params), { method: 'GET' });
    },
    async post(path, body): Promise<unknown> {
      return request(path, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
  };
}
