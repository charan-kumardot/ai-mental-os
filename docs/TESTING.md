# Testing

## Automated: pure-logic unit tests

No test framework dependency — uses Node's built-in `node:test` runner, so `npm test` works with zero extra install in each function directory.

```bash
cd functions/process-mental-inbox && npm test   # 9 tests: safety.test.js
cd functions/generate-insight && npm test        # 8 tests: stats.test.js, grounding.test.js
```

**Covered**: the Safety Engine's classification (true positives for self-harm/harm-to-others phrasing, true negatives for ordinary difficult-day language and idiomatic false-friends like "I could kill for a coffee"), the mood-trend statistics gate logic (mean/recent-mean/stdDev, the 0.4 deviation threshold), and the AI grounding preamble (evidence inclusion, anti-hallucination instructions present).

**Not covered by automated tests**: anything requiring the Appwrite runtime context (`req`/`res`/`log`/`error` objects), the actual HTTP calls to Groq, or any mobile UI code. These were verified manually (see below) rather than with mocks, since mocking Appwrite's function context and Groq's API faithfully would have been more effort than it was worth for a project this size — real-device verification caught real bugs (wrong model ID, empty AI responses from a token-budget issue) that mocks would likely have missed entirely.

## Manual: real-device verification

Every feature listed as ✅ in the root README was verified by actually running it on a physical Android device (Moto G62 5G) connected via `adb` over WiFi, driving the app with a mix of Maestro (`maestro test <flow>.yaml`, tapping by visible text) and direct `adb shell input tap` (used when Maestro's tap resolution stalled against the app's continuously-animated background — a known friction point, not a bug in the app), and confirming results two ways:
1. Screenshot (`adb exec-out screencap -p`) of the actual rendered UI
2. Direct query of the Appwrite database / function execution logs via the server SDK, to confirm the *backend* result matched what the UI showed (not just that a spinner disappeared)

This caught real bugs that a UI-only check would have missed, including:
- A routing race condition that could silently bounce a fully-onboarded user back to onboarding on cold start (`apps/mobile/src/lib/profile-context.tsx`)
- An Android status bar rendering as an opaque black bar instead of the app's translucent design
- A `TextField` component silently discarding all its base styling whenever a caller passed a `style` prop
- The Groq `gpt-oss` empty-response issue (see `docs/AI.md`)

## What hasn't been tested

- No integration/E2E test suite exists as *code* (i.e. nothing runs automatically in CI) — see `docs/ARCHITECTURE.md`, there is no CI/CD pipeline yet.
- No load/concurrency testing.
- No testing on iOS (dev device is Android-only).
- Synthetic multi-user scenarios (spec section 101 — different users getting different recommendations from the same input) aren't testable yet because the personalization engine that would differentiate them (pattern learning, intervention outcome tracking) isn't built yet.
