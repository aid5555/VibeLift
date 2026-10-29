import { describe, expect, it, vi } from 'vitest';
import { ExternalApiError, NotFoundError, ValidationError } from '@/lib/errors';
import type { LyftaClient, LyftaWorkout } from '@/lib/lyfta';
import { createLyftaService, LyftaService } from '@/services/lyftaService';

const sampleWorkout: LyftaWorkout = {
  id: 'w1',
  name: 'Full Body',
  description: 'A full body workout',
  durationMinutes: 30,
  difficulty: 'intermediate',
};

function mockClient(overrides: Partial<LyftaClient> = {}): LyftaClient {
  return {
    get: vi.fn(async () => []),
    post: vi.fn(async () => ({})),
    ...overrides,
  };
}

describe('LyftaService', () => {
  it('fetches and validates workouts', async () => {
    const get = vi.fn(async () => [sampleWorkout]);
    const service = new LyftaService(mockClient({ get }));

    const result = await service.getWorkouts();

    expect(result).toEqual([sampleWorkout]);
    expect(get).toHaveBeenCalledWith('/workouts');
  });

  it('rejects an invalid workouts response with ValidationError', async () => {
    const get = vi.fn(async () => [{ id: 'w1' }]); // missing required fields
    const service = new LyftaService(mockClient({ get }));

    await expect(service.getWorkouts()).rejects.toBeInstanceOf(ValidationError);
  });

  it('maps a 404 upstream error to NotFoundError', async () => {
    const get = vi.fn(async () => {
      throw new ExternalApiError('not found', 404);
    });
    const service = new LyftaService(mockClient({ get }));

    await expect(service.getWorkoutById('missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('rethrows non-404 upstream errors unchanged', async () => {
    const error = new ExternalApiError('server error', 500);
    const get = vi.fn(async () => {
      throw error;
    });
    const service = new LyftaService(mockClient({ get }));

    await expect(service.getWorkoutById('w1')).rejects.toBe(error);
  });

  it('posts a validated workout plan generation request', async () => {
    const post = vi.fn(async () => [sampleWorkout]);
    const service = new LyftaService(mockClient({ post }));
    const input = { goal: 'strength', daysPerWeek: 3, durationMinutes: 45 };

    const result = await service.generateWorkoutPlan(input);

    expect(result).toEqual([sampleWorkout]);
    expect(post).toHaveBeenCalledWith('/workouts/generate', input);
  });
});

describe('createLyftaService (transport integration)', () => {
  it('sends the Authorization header and parses JSON', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify([sampleWorkout]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const service = createLyftaService(
      { baseUrl: 'https://api.example.com/', apiKey: 'secret' },
      fetchImpl,
    );

    const result = await service.getWorkouts();

    expect(result).toEqual([sampleWorkout]);
    const call = fetchImpl.mock.calls[0];
    if (!call) {
      throw new Error('fetch was not called');
    }
    const [url, init] = call;
    expect(url).toBe('https://api.example.com/workouts');
    expect((init?.headers as Record<string, string> | undefined)?.Authorization).toBe(
      'Bearer secret',
    );
  });

  it('throws ExternalApiError on a non-2xx response', async () => {
    const fetchImpl = vi.fn(async () => new Response('oops', { status: 500 }));
    const service = createLyftaService(
      { baseUrl: 'https://api.example.com', apiKey: 'secret' },
      fetchImpl,
    );

    await expect(service.getWorkouts()).rejects.toBeInstanceOf(ExternalApiError);
  });
});
