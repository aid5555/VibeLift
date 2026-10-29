import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ExternalApiError, ValidationError } from '@/lib/errors';
import {
  AiService,
  executeToolCall,
  ToolRegistry,
  type AiMessage,
  type AiTool,
} from '@/services/aiService';

const caloriesTool: AiTool<{ weightKg: number; minutes: number }, number> = {
  name: 'estimate_calories',
  description: 'Estimate calories burned from weight and duration.',
  parameters: {
    type: 'object',
    properties: {
      weightKg: { type: 'number' },
      minutes: { type: 'number' },
    },
    required: ['weightKg', 'minutes'],
  },
  inputSchema: z.object({
    weightKg: z.number().positive(),
    minutes: z.number().positive(),
  }),
  handler: async ({ weightKg, minutes }) =>
    Math.round(weightKg * minutes * 0.06),
};

describe('ToolRegistry', () => {
  it('registers, lists, and serializes tools for the model', () => {
    const registry = new ToolRegistry();
    registry.register(caloriesTool);

    expect(registry.get('estimate_calories')).toBeDefined();
    expect(registry.toOpenAiFunctions()).toEqual([
      {
        name: 'estimate_calories',
        description: caloriesTool.description,
        parameters: caloriesTool.parameters,
      },
    ]);
  });

  it('throws when registering a duplicate tool name', () => {
    const registry = new ToolRegistry();
    registry.register(caloriesTool);
    expect(() => registry.register(caloriesTool)).toThrow(ValidationError);
  });
});

describe('executeToolCall', () => {
  it('executes a handler with validated arguments', async () => {
    const registry = new ToolRegistry();
    registry.register(caloriesTool);

    const result = await executeToolCall(registry, {
      id: 'call_1',
      name: 'estimate_calories',
      arguments: { weightKg: 70, minutes: 30 },
    });

    expect(result).toBe(126);
  });

  it('throws ValidationError for an unknown tool', async () => {
    const registry = new ToolRegistry();
    await expect(
      executeToolCall(registry, { id: 'call_1', name: 'nope', arguments: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for invalid arguments', async () => {
    const registry = new ToolRegistry();
    registry.register(caloriesTool);
    await expect(
      executeToolCall(registry, {
        id: 'call_1',
        name: 'estimate_calories',
        arguments: { weightKg: -5, minutes: 30 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('AiService.chat', () => {
  const config = {
    baseUrl: 'http://localhost:8787',
    apiKey: 'ai-secret',
    model: 'gpt-4o-mini',
  };

  it('returns the assistant message when no tool call is requested', async () => {
    const registry = new ToolRegistry();
    registry.register(caloriesTool);

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { role: 'assistant', content: 'Here is your plan!' },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const service = new AiService(config, registry, fetchImpl);
    const messages: AiMessage[] = [{ role: 'user', content: 'Plan my day' }];

    const result = await service.chat(messages);

    expect(result).toEqual({ role: 'assistant', content: 'Here is your plan!' });
  });

  it('executes tool calls and returns the final answer', async () => {
    const registry = new ToolRegistry();
    registry.register(caloriesTool);

    const responses = [
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'estimate_calories',
                    arguments: JSON.stringify({ weightKg: 70, minutes: 30 }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      },
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'You burned about 126 calories.',
            },
            finish_reason: 'stop',
          },
        ],
      },
    ];

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(responses[0]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(responses[1]), { status: 200 }));
    const service = new AiService(config, registry, fetchImpl);
    const messages: AiMessage[] = [{ role: 'user', content: 'How many calories?' }];

    const result = await service.chat(messages);

    expect(result.content).toBe('You burned about 126 calories.');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws ExternalApiError when the API returns an error status', async () => {
    const registry = new ToolRegistry();
    const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const service = new AiService(config, registry, fetchImpl);

    await expect(
      service.chat([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(ExternalApiError);
  });
});
