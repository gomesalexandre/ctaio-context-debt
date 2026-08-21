import { z } from 'zod';

const BASE = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const KEY = process.env.OPENROUTER_API_KEY;

/**
 * Two model families on purpose. The mapper proposes findings; the simulator is
 * a different vendor so the second opinion isn't the same brain grading its own
 * homework. Both are flash/cheap tiers — this runs weekly on a cron, not once.
 */
export const MODELS = {
  mapper: process.env.MAPPER_MODEL ?? 'google/gemini-3-flash-preview',
  simulator: process.env.SIMULATOR_MODEL ?? 'deepseek/deepseek-v4-flash',
  architect: process.env.ARCHITECT_MODEL ?? 'google/gemini-3-flash-preview',
} as const;

export class LlmError extends Error {}

/** Convert a zod object schema to the JSON Schema shape OpenRouter wants. */
function jsonSchemaFor(name: string, schema: Record<string, unknown>) {
  return {
    type: 'json_schema' as const,
    json_schema: { name, strict: true, schema },
  };
}

/**
 * One call, structured output enforced at the API layer, then re-validated
 * locally with zod. Belt and braces: strict mode can still hand back something
 * that parses as JSON but violates our semantics, so zod is the real gate.
 * One retry on invalid output, with the parse error fed back to the model.
 */
export async function callStructured<T>(opts: {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
  maxTokens?: number;
}): Promise<{ value: T; ms: number; retried: boolean }> {
  if (!KEY) throw new LlmError('OPENROUTER_API_KEY is unset — refusing to run.');

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.user },
  ];

  const started = Date.now();
  let retried = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${KEY}`,
        'content-type': 'application/json',
        'x-title': 'ctaio-context-debt',
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        response_format: jsonSchemaFor(opts.schemaName, opts.jsonSchema),
        max_tokens: opts.maxTokens ?? 3000,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      throw new LlmError(`${opts.model} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: unknown;
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new LlmError(`${opts.model} returned no content: ${JSON.stringify(body).slice(0, 300)}`);

    try {
      const parsed = opts.validator.parse(JSON.parse(raw));
      return { value: parsed, ms: Date.now() - started, retried };
    } catch (err) {
      if (attempt === 1) {
        throw new LlmError(`${opts.model} failed schema twice: ${String(err).slice(0, 300)}`);
      }
      retried = true;
      messages.push({ role: 'assistant', content: raw });
      messages.push({
        role: 'user',
        content: `That failed validation: ${String(err).slice(0, 500)}\nReturn ONLY valid JSON matching the schema.`,
      });
    }
  }

  throw new LlmError('unreachable');
}
