import { getEnv } from '@/env';
import { fail, handleError, ok } from '@/lib/response';
import { createLyftaService, generateWorkoutInputSchema } from '@/services/lyftaService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    const parsed = generateWorkoutInputSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.issues);
    }

    const env = getEnv();
    const service = createLyftaService({
      baseUrl: env.LYFTA_BASE_URL,
      apiKey: env.LYFTA_API_KEY,
    });
    const plan = await service.generateWorkoutPlan(parsed.data);

    return ok(plan, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
