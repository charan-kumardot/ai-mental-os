import type { AIProvider, GenerateOptions, GenerateResult } from '../types';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5';

export function createOpenRouterProvider(apiKey: string, model = DEFAULT_MODEL): AIProvider {
  return {
    name: 'openrouter',
    async generate(opts: GenerateOptions): Promise<GenerateResult> {
      const start = Date.now();
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
          ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = await res.json();
      return {
        text: data.choices?.[0]?.message?.content ?? '',
        provider: 'openrouter',
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
