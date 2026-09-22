/**
 * Shared types for the AI model gateway. Tier selection follows the
 * spec's cost-aware escalation ladder (section 58):
 *   rules/SQL -> statistics -> embeddings -> cheap model -> reasoning model
 * The gateway only ever gets invoked for the last two steps — anything
 * a deterministic computation can answer should never reach here.
 */

export type ModelTier = 'fast' | 'reasoning';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  tier: ModelTier;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface GenerateResult {
  text: string;
  provider: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
  latencyMs: number;
}

export interface AIProvider {
  name: string;
  generate(opts: GenerateOptions): Promise<GenerateResult>;
}
