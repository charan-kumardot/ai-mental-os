import type { AIProvider, GenerateOptions, GenerateResult, ModelTier } from './types';
import { createOpenRouterProvider } from './providers/openrouter';
import { createGroqProvider } from './providers/groq';

export interface GatewayConfig {
  openrouterApiKey?: string;
  groqApiKey?: string;
}

/**
 * Model gateway: routes by tier, tries providers in order, falls back on
 * failure rather than surfacing an error to the caller. Per section 58,
 * this should only ever be reached after cheaper deterministic options
 * (SQL, rules, stats) have been ruled out by the caller.
 */
export function createGateway(config: GatewayConfig) {
  const fastProviders: AIProvider[] = [];
  const reasoningProviders: AIProvider[] = [];

  // Groq first in both tiers: it's the provider that's actually reachable
  // with the configured keys (OpenRouter's key has no purchased credits as
  // of this writing — see ENVIRONMENT.md). OpenRouter stays in the chain as
  // a fallback so it activates automatically once credits are added, without
  // code changes.
  if (config.groqApiKey) {
    fastProviders.push(createGroqProvider(config.groqApiKey, 'openai/gpt-oss-20b'));
    reasoningProviders.push(createGroqProvider(config.groqApiKey, 'openai/gpt-oss-120b'));
  }
  if (config.openrouterApiKey) {
    fastProviders.push(createOpenRouterProvider(config.openrouterApiKey, 'meta-llama/llama-3.3-70b-instruct'));
    reasoningProviders.push(createOpenRouterProvider(config.openrouterApiKey));
  }

  async function generate(opts: GenerateOptions): Promise<GenerateResult> {
    const chain = opts.tier === 'fast' ? fastProviders : reasoningProviders;
    if (chain.length === 0) {
      throw new Error(`No AI provider configured for tier "${opts.tier}"`);
    }

    let lastError: unknown;
    for (const provider of chain) {
      try {
        return await provider.generate(opts);
      } catch (err) {
        lastError = err;
        console.warn(`[ai-gateway] ${provider.name} failed for tier "${opts.tier}":`, err);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All AI providers failed');
  }

  return { generate };
}

export type { ModelTier, ChatMessage, GenerateOptions, GenerateResult, AIProvider } from './types';
