import type { AIProvider, GenerateOptions, GenerateResult } from '../types';

const DEFAULT_MODEL = 'openai/gpt-oss-20b';

export function createGroqProvider(apiKey: string, model = DEFAULT_MODEL): AIProvider {
  return {
    name: 'groq',
    async generate(opts: GenerateOptions): Promise<GenerateResult> {
      const start = Date.now();
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 600,
          // gpt-oss models are reasoning models — without this, they can
          // spend the entire token budget on hidden chain-of-thought and
          // return empty `content` (reproduced against the live API).
          reasoning_effort: 'low',
          ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Groq error ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) {
        throw new Error(`Groq returned empty content (finish_reason: ${data.choices?.[0]?.finish_reason})`);
      }
      return {
        text,
        provider: 'groq',
        model: data.model ?? model,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
        },
        latencyMs: Date.now() - start,
      };
    },
  };
}
