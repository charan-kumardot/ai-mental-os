# Personal OS

An AI-native personal wellbeing and sustainable-performance system. Core promise: don't just detect how you feel — learn what affects your state and what actually works for *you*.

This README reflects the **actual, verified state** of the project as of 2026-09-21, not an aspirational spec. Every feature marked ✅ has been tested end-to-end on a real Android device (Moto G62 5G) against a live Appwrite backend and real AI providers — most now via a real native dev-client build, not Expo Go. See [`docs/STATUS.md`](docs/STATUS.md) for the full, itemized build log.

## What's real right now

**Core loop**
- ✅ Sign up / sign in / sign out (Appwrite Auth)
- ✅ Progressive onboarding (goals, profile, interaction style)
- ✅ 5-tap mood check-in, persisted per-user with document-level security
- ✅ AI-generated grounded insights (Groq LLM) — gated behind deterministic rules (needs ≥5 check-ins *and* a real deviation before ever calling an LLM); every insight carries an evidence trail
- ✅ Weekly Review — real 7-day aggregation vs. the prior week, grounded AI narrative, honest "not enough data" state below 3 check-ins
- ✅ Mental Inbox — free-text dump, AI-categorized (action/decision/emotional/etc.), resolve/unresolve toggle
- ✅ Voice reflection — record → Groq Whisper transcription → confirm/edit/discard
- ✅ N-of-1 Experiments — propose a hypothesis, then conclude it (confirmed/not confirmed/inconclusive, with a saved observation note) or abandon it
- ✅ Independent Safety Engine — deterministic keyword-based crisis detection runs *before* any other processing on free-text/voice input, logs an audit event, returns a warm non-diagnostic response pointing to real resources (never a bare LLM call on flagged content)
- ✅ "What I've collected" graph on the Brain tab — an honest visualization of real data volume per source (not invented cross-dimension patterns — see below)
- ✅ Data export (client-side JSON bundle + native share sheet)
- ✅ Full account deletion (server-side, cascades every collection, then the auth account itself)
- ✅ On-brand app icon/splash asset set (generated from the real design tokens, not the Expo default)
- ✅ Decision Debt — structures an unresolved decision into known/unknown/options/next-step; deliberately never decides for the user
- ✅ Personal Operating Manual — grounded "how I work" text from real hour-of-day mood patterns, concluded-experiment outcomes and mental-inbox category frequency, gated behind a minimum-data threshold
- ✅ Intervention Lab / Autopilot — a library of short, low-risk techniques (breathing/movement/sensory/cognitive/social/rest) plus user-created custom ones; deterministic (non-AI) N-of-1 ranking learns which ones this specific user rated as helping, gated behind a minimum-feedback threshold with an honest "still learning" state below it
- ✅ Calendar integration — real device calendar access (`expo-calendar`, no Google OAuth needed), meeting count/density/free-window synced daily, never titles or attendees
- ✅ Health Connect — steps, sleep, resting heart rate via `react-native-health-connect`; handles partial permission grants, honestly reports when Health Connect isn't installed or has no data yet rather than failing or fabricating numbers; Brain tab's Sleep confidence now sources from this
- ✅ Push notifications — real local daily reminder (Android system permission + scheduled OS alarm, verified via `dumpsys`), now that a native dev-client build exists
- ✅ Today rings — Energy and Recovery now driven by a real Personal Baseline Engine (see below) rather than a fixed daily target; Focus stays honestly "None yet" since no real focus signal exists; includes a "what changed since yesterday" delta and a link to the Intervention Lab's top-ranked personal suggestion when one exists
- ✅ Cross-dimension pattern detection ("Relationship map") — real Pearson correlation (deterministic, not AI) across mood/sleep/steps/meetings, gated behind ≥10 overlapping days and |r| ≥ 0.4 before a pair is even considered; AI only phrases a relationship that already cleared both statistical gates, never invents one. Verified end-to-end against 25 days of engineered sample data seeded into a throwaway test account: correctly found the planted sleep↔mood correlation at the right strength and day count, and correctly did *not* flag the deliberately-uncorrelated steps dimension.
- ✅ Personal Baseline Engine + Personal State Engine + Baseline Drift — short/medium/long-term rolling baselines per dimension, each window only populated once it has real minimum evidence; today's state is your own short-term baseline compared against today, not a population average or fixed target ("Sleep: 2h 5m below your normal," matching the spec's own example phrasing exactly). Focus/Stress stay honestly `null` — no real source exists for them. Verified live against seeded sample data with a deliberately extreme "today," correctly classifying Energy=high/Recovery=low to match.
- ✅ Contradiction Engine + prediction calibration — detected patterns are no longer trusted forever from the moment they're found: each refresh re-correlates every tracked pattern against the latest data, recalculating confidence from fresh evidence or retiring a pattern after two consecutive contradictions, rather than a confidence score frozen at creation.

**Not built yet, honestly**
- ❌ HealthKit (iOS) — no Mac/Xcode in this dev environment; Android's Health Connect equivalent is done (see above)
- ❌ Production/EAS build — blocked on interactive Expo account login, which this environment can't complete without a browser
- ❌ CI/CD pipeline, admin panel, web app
- ❌ Personal Playbooks, Memory Architecture, Daily Briefing, Adaptive Friction Engine, Privacy Modes, granular per-source data deletion, Automatic Experiment Discovery, Recovery Debt, and other gaps surfaced by a full section-by-section audit against `master_prompt.md` — see `docs/STATUS.md`'s 2026-09-21 "Eighth session" entry for the complete list

## Tech stack

- **Mobile**: Expo SDK 57 (React Native 0.86, New Architecture), Expo Router, TypeScript
- **Backend**: Appwrite Cloud (`sgp` region) — Auth, Databases (20 collections, document-level security), Functions
- **AI**: Groq (`openai/gpt-oss-20b` for fast-tier text, `whisper-large-v3-turbo` for speech-to-text) as the primary, working provider. OpenRouter is wired as a fallback but **has no purchased credits** — see [`docs/AI.md`](docs/AI.md).
- **Design system**: custom glass/orb visual language — see `apps/mobile/src/theme/tokens.ts` and the design preview artifact published during this build

## Project structure

```
apps/mobile/          Expo Router app (screens in app/, shared code in src/)
packages/appwrite/     Database schema (schema.ts) + provisioning/dev scripts
packages/ai/           Shared AI gateway (used as a reference; deployed functions
                        ship self-contained copies — see docs/AI.md for why)
functions/
  generate-insight/     Mood-trend insight generation (deterministic gates + Groq)
  process-mental-inbox/ General user-action processor — mental inbox, voice
                         reflection, safety gate, account deletion (routed by
                         `action` field; this Appwrite plan caps functions at 2,
                         see docs/ARCHITECTURE.md)
docs/                   Architecture, safety, privacy, environment, testing docs
```

## Local development

```bash
# 1. Copy env template and fill in real values
cp .env.example .env

# 2. Provision the Appwrite database (idempotent — safe to re-run)
cd packages/appwrite && npm install && npm run setup

# 3. Deploy the two Appwrite Functions
cd functions/generate-insight && npm install && node scripts/deploy.mjs
cd ../process-mental-inbox && npm install && node scripts/deploy.mjs

# 4. Run the mobile app
cd apps/mobile
cp .env.example .env   # EXPO_PUBLIC_APPWRITE_ENDPOINT / PROJECT_ID (not secret — needed client-side)
npx expo start --android   # scan with Expo Go, or press 'a' with a device/emulator attached
```

## Testing

Pure-logic unit tests (safety classifier, mood-trend statistics, grounding preamble) run with Node's built-in test runner — no Appwrite or network dependency:

```bash
cd functions/process-mental-inbox && npm test
cd functions/generate-insight && npm test
```

See [`docs/TESTING.md`](docs/TESTING.md) for what is and isn't covered.

## Further reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, the Appwrite-function-count constraint and how it shaped things
- [`docs/AI.md`](docs/AI.md) — model gateway, provider status, the `gpt-oss` reasoning-model gotcha
- [`docs/SAFETY.md`](docs/SAFETY.md) — the Safety Engine in detail
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — data export/deletion, permission model
- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) — every env var, what it's for, where to get it
- [`docs/TESTING.md`](docs/TESTING.md) — automated coverage and manual verification method
- [`docs/STATUS.md`](docs/STATUS.md) — itemized, dated build log of what's been built and verified
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — how to get from this verified dev build to a real installable app (EAS Build steps you run yourself — needs an interactive Expo login this environment can't do)
