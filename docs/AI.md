# AI

## Provider status (as of 2026-09-20)

| Provider | Status | Used for |
|---|---|---|
| **Groq** | ✅ Working, primary | Fast-tier text generation (`openai/gpt-oss-20b`), speech-to-text (`whisper-large-v3-turbo`) |
| **OpenRouter** | ⚠️ Configured but **no purchased credits** — every call 402s | Wired as fallback in `packages/ai`'s gateway; activates automatically once credits are added, no code change needed. Check `openrouter.ai/settings/credits` before assuming it works. |
| Gemini, Ollama Cloud, z.ai | Not integrated | API keys were provided but no call sites exist yet |

## The `gpt-oss` reasoning-model gotcha

`openai/gpt-oss-20b` (and likely other `gpt-oss` models) is a **reasoning model** — it puts chain-of-thought in a separate `reasoning` field on the response, distinct from `content`. With Groq's default `reasoning_effort` and a modest `max_tokens` (e.g. 200), it can burn the *entire* token budget on hidden reasoning and return **empty `content`** with `finish_reason: "length"`. This was reproduced live and initially shipped a blank-body insight to the database before being caught.

**Fix applied everywhere Groq is called**: pass `reasoning_effort: "low"` and a generous `max_tokens` (300–500+), and throw if `content.trim()` is empty rather than silently saving nothing. See `functions/generate-insight/src/main.js`, `functions/process-mental-inbox/src/main.js`, and `packages/ai/src/providers/groq.ts`.

If a new Groq call site is added, apply the same two guards.

## Cost-aware escalation ladder (spec-mandated, actually implemented)

`generate-insight` never calls an LLM unless two deterministic gates both pass:
1. At least 5 check-ins exist (`functions/generate-insight/src/main.js`).
2. The recent-vs-baseline mood deviation exceeds 0.4 on a 1–5 scale (`src/stats.js`, unit tested in `src/stats.test.js`).

Both gates are pure functions with no network dependency — see `docs/TESTING.md`.

## Grounding / anti-hallucination

Every insight-generating call is preceded by a system prompt built by `buildGroundingPreamble()` (`functions/generate-insight/src/grounding.js`), which:
- Lists only the specific evidence assembled deterministically beforehand (never "the user's full history")
- Explicitly forbids inventing data and forbids causal medical claims
- Requires hedged language ("appears associated with", "may be contributing")

Unit tested in `grounding.test.js`.

## Safety classification is NOT AI-based

The Safety Engine (`functions/process-mental-inbox/src/safety.js`) is deliberately **keyword/regex-based, not an LLM call** — a safety gate needs to be fast, auditable, and not depend on a model being available or behaving predictably. See `docs/SAFETY.md`.
