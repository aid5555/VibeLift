import { getEnv } from '@/env';
import { handleError, ok } from '@/lib/response';
import { createLyftaService } from '@/services/lyftaService';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const env = getEnv();
    const service = createLyftaService({
      baseUrl: env.LYFTA_BASE_URL,
      apiKey: env.LYFTA_API_KEY,
    });
    const workouts = await service.getWorkouts();
    return ok(workouts);
  } catch (error) {
    return handleError(error);
  }
}
