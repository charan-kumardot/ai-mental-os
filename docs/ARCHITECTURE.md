# Architecture

## Overview

Personal OS is a mobile-first app (Expo/React Native) backed entirely by Appwrite Cloud — no separate custom server. Business logic that must run trusted (AI calls with API keys, safety gating, account deletion) lives in Appwrite Functions; everything else is direct client-to-Appwrite calls governed by document-level permissions.

```
apps/mobile (Expo Router)
      │
      ├─ Appwrite Auth (email/password sessions)
      ├─ Appwrite Databases (20 collections, document-level security)
      └─ Appwrite Functions
           ├─ generate-insight        (mood-trend insights)
           └─ process-mental-inbox    (mental inbox, voice reflection,
                                        safety gate, account deletion)
```

## The 2-function constraint

This Appwrite project's plan caps **total Functions at 2** — confirmed empirically by a `403 additional_resource_not_allowed` error when a 3rd function was created during this build. Rather than blocking on a plan upgrade, `process-mental-inbox` was deliberately generalized into a **user-action processor**, routed by a `body.action` field:

| `action` value | What it does |
|---|---|
| *(none)* | Original mental-inbox flow: safety gate → AI categorization → save |
| `voice_reflection` | Transcribe (Whisper) → safety gate → intent/event/emotion extraction, returns for confirmation (does not save yet) |
| `save_voice_reflection` | Persists a confirmed voice reflection |
| `delete_account` | Cascading delete across every collection, then the auth account |

If the Appwrite plan is upgraded and the function cap lifts, these could be split into dedicated functions — but there's no functional reason to; the routing pattern works fine and keeps deployment simpler (one thing to redeploy instead of four).

## Why functions ship self-contained code

Appwrite's function build environment runs `npm install` against exactly what's in the deployed tarball — it can't resolve local monorepo workspace packages like `@ai-mental-os/ai`. Rather than fight that, each function under `functions/*` ships small **duplicated** copies of the AI-calling and safety logic (e.g. `functions/generate-insight/src/grounding.js` and `functions/process-mental-inbox/src/safety.js` are separate files, not imports from `packages/ai`). `packages/ai` remains the canonical reference implementation for any future long-running Node service, but isn't literally imported by the deployed functions today.

## Data model

Full schema in `packages/appwrite/schema.ts` (single source of truth — keep `apps/mobile/src/lib/appwrite.ts`'s `COLLECTIONS` constant in sync when adding a collection). Every collection has `documentSecurity: true`; row-level isolation comes entirely from per-document permissions set at write time (`Permission.read/update/delete(Role.user(userId))`), not from collection-level rules. Collections marked `serverOnly` in the schema restrict *create* to server (API-key) callers only — users can still read their own documents in them (e.g. `insights`, `state_estimates`).

## Mobile app structure

- `app/` — Expo Router file-based routes. `(auth)`, `(onboarding)`, `(tabs)` are route groups; `mental-inbox.tsx` and `voice-reflection.tsx` are standalone modal-style screens outside the tab bar.
- `src/lib/` — Appwrite client setup and per-feature data access (`checkins.ts`, `mentalInbox.ts`, `voiceReflection.ts`, `privacy.ts`, `profile-context.tsx`, `auth-context.tsx`).
- `src/components/` — Design-system components (`GlassCard`, `AIOrb`, `PrimaryButton`, `EvidenceSheet`, `ScreenBackground`, `AmbientBackground`).
- `src/theme/` — Design tokens (colors, spacing, typography, motion) and `ThemeProvider`.

## Known environment constraints

- **No Android SDK installed** in this dev environment → no native/dev-client builds possible → Health Connect, Calendar OAuth, and push notifications are all blocked until that changes (or an EAS cloud build is used).
- **npm workspaces + Metro**: shared deps hoist to the workspace root; `apps/mobile/metro.config.js` extends `watchFolders`/`nodeModulesPaths` to cover this, but Metro's module cache still needs a full `npx expo start --android --clear` (not just Fast Refresh) after installing any new package mid-session.
