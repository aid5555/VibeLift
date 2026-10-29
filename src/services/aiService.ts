import { z } from 'zod';
import { ExternalApiError, ValidationError } from '@/lib/errors';
import type { FetchLike } from '@/types';

/**
 * AI service: OpenAI/OpenCode function-calling client plus a typed tool registry
 * and execution harness.
 */

export interface AiTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  /** JSON Schema describing arguments, sent verbatim to the model. */
  parameters: Record<string, unknown>;
  /** Zod schema used to validate model-provided arguments at runtime. */
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput> | TOutput;
}

export type AiRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiMessage {
  role: AiRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxToolSteps?: number;
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private readonly tools = new Map<string, AiTool<unknown, unknown>>();

  register<TInput, TOutput>(tool: AiTool<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new ValidationError(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool as AiTool<unknown, unknown>);
  }

  get(name: string): AiTool<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  list(): AiTool<unknown, unknown>[] {
    return Array.from(this.tools.values());
  }

  toOpenAiFunctions(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}

/**
 * Execute a single model-issued tool call against the registry, validating its
 * arguments with the tool's Zod schema before invoking the handler.
 */
export async function executeToolCall(
  registry: ToolRegistry,
  toolCall: AiToolCall,
): Promise<unknown> {
  const tool = registry.get(toolCall.name);
  if (!tool) {
    throw new ValidationError(`Unknown tool "${toolCall.name}".`);
  }

  const parsed = tool.inputSchema.safeParse(toolCall.arguments);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid arguments for tool "${toolCall.name}".`,
      parsed.error.issues,
    );
  }

  return tool.handler(parsed.data);
}

// ---------------------------------------------------------------------------
// OpenAI-compatible response schema
// ---------------------------------------------------------------------------

const openAiToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const openAiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.literal('assistant'),
          content: z.string().nullable().optional(),
          tool_calls: z.array(openAiToolCallSchema).optional(),
        }),
        finish_reason: z.string(),
      }),
    )
    .min(1),
});

function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new ExternalApiError('AI returned malformed tool arguments JSON.', undefined, {
      cause: error,
    });
  }
}

// ---------------------------------------------------------------------------
// AI client
// ---------------------------------------------------------------------------

export class AiService {
  constructor(
    private readonly config: AiConfig,
    private readonly registry: ToolRegistry,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  /**
   * Run a conversation to completion, executing any requested tool calls in a
   * loop (up to `maxToolSteps`) before returning the final assistant message.
   */
  async chat(messages: AiMessage[]): Promise<AiMessage> {
    const conversation: AiMessage[] = [...messages];
    const maxSteps = this.config.maxToolSteps ?? 5;

    for (let step = 0; step < maxSteps; step += 1) {
      const { message, toolCalls } = await this.requestCompletion(conversation);

      if (toolCalls.length === 0) {
        return message;
      }

      conversation.push(message);

      for (const toolCall of toolCalls) {
        const result = await executeToolCall(this.registry, toolCall);
        conversation.push({
          role: 'tool',
          content: JSON.stringify(result),
          name: toolCall.name,
          toolCallId: toolCall.id,
        });
      }
    }

    throw new ExternalApiError(
      `AI did not converge within ${maxSteps} tool-calling steps.`,
    );
  }

  private async requestCompletion(
    messages: AiMessage[],
  ): Promise<{ message: AiMessage; toolCalls: AiToolCall[] }> {
    const response = await this.fetchImpl(
      `${this.config.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          tools: this.registry.toOpenAiFunctions().map((fn) => ({
            type: 'function',
            function: fn,
          })),
        }),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new ExternalApiError(
        `AI API responded with ${response.status}`,
        response.status,
        { cause: bodyText },
      );
    }

    const raw: unknown = await response.json();
    const parsed = openAiResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ExternalApiError(
        'AI API returned an unexpected response shape.',
        response.status,
        { cause: parsed.error.issues },
      );
    }

    const choice = parsed.data.choices[0];
    if (!choice) {
      throw new ExternalApiError('AI API returned no choices.');
    }

    const toolCalls: AiToolCall[] = (choice.message.tool_calls ?? []).map(
      (call) => ({
        id: call.id,
        name: call.function.name,
        arguments: parseToolArguments(call.function.arguments),
      }),
    );

    return {
      message: { role: 'assistant', content: choice.message.content ?? '' },
      toolCalls,
    };
  }
}
