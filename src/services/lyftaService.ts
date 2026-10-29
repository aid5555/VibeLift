import { z } from 'zod';
import { ExternalApiError, NotFoundError } from '@/lib/errors';
import {
  createLyftaClient,
  lyftaExerciseSchema,
  lyftaNutritionPlanSchema,
  lyftaWorkoutLogSchema,
  lyftaWorkoutSchema,
  type LyftaClient,
  type LyftaConfig,
  type LyftaExercise,
  type LyftaNutritionPlan,
  type LyftaWorkout,
  type LyftaWorkoutLog,
} from '@/lib/lyfta';
import { parseOrThrow } from '@/lib/validation';
import type { FetchLike } from '@/types';

export const generateWorkoutInputSchema = z.object({
  goal: z.string().min(3).max(200),
  daysPerWeek: z.number().int().min(1).max(7),
  durationMinutes: z.number().int().min(5).max(180),
});
export type GenerateWorkoutInput = z.infer<typeof generateWorkoutInputSchema>;

export const logWorkoutInputSchema = z.object({
  workoutId: z.string().min(1),
  completedAt: z.string().min(1),
});
export type LogWorkoutInput = z.infer<typeof logWorkoutInputSchema>;

const workoutsResponseSchema = z.array(lyftaWorkoutSchema);
const exercisesResponseSchema = z.array(lyftaExerciseSchema);

/**
 * Domain service for Lyfta fitness data. Validates every response with Zod and
 * maps transport failures into typed application errors.
 */
export class LyftaService {
  constructor(private readonly client: LyftaClient) {}

  async getWorkouts(): Promise<LyftaWorkout[]> {
    const data = await this.client.get('/workouts');
    return parseOrThrow(workoutsResponseSchema, data, 'Lyfta /workouts response');
  }

  async getWorkoutById(id: string): Promise<LyftaWorkout> {
    try {
      const data = await this.client.get(`/workouts/${encodeURIComponent(id)}`);
      return parseOrThrow(lyftaWorkoutSchema, data, `Lyfta /workouts/${id} response`);
    } catch (error) {
      if (error instanceof ExternalApiError && error.upstreamStatus === 404) {
        throw new NotFoundError(`Workout "${id}" was not found.`);
      }
      throw error;
    }
  }

  async searchExercises(query: string): Promise<LyftaExercise[]> {
    const data = await this.client.get('/exercises', { q: query });
    return parseOrThrow(exercisesResponseSchema, data, 'Lyfta /exercises response');
  }

  async generateWorkoutPlan(input: GenerateWorkoutInput): Promise<LyftaWorkout[]> {
    const parsed = generateWorkoutInputSchema.parse(input);
    const data = await this.client.post('/workouts/generate', parsed);
    return parseOrThrow(workoutsResponseSchema, data, 'Lyfta /workouts/generate response');
  }

  async getNutritionPlan(userId: string): Promise<LyftaNutritionPlan> {
    const data = await this.client.get('/nutrition/plan', { userId });
    return parseOrThrow(lyftaNutritionPlanSchema, data, 'Lyfta /nutrition/plan response');
  }

  async logWorkout(input: LogWorkoutInput): Promise<LyftaWorkoutLog> {
    const parsed = logWorkoutInputSchema.parse(input);
    const data = await this.client.post('/workouts/log', parsed);
    return parseOrThrow(lyftaWorkoutLogSchema, data, 'Lyfta /workouts/log response');
  }
}

export function createLyftaService(
  config: LyftaConfig,
  fetchImpl?: FetchLike,
): LyftaService {
  return new LyftaService(createLyftaClient(config, fetchImpl));
}
