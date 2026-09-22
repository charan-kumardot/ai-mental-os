# Privacy

## Principles (from the product spec, actually implemented where noted)

> Your mind. Your data. Your control. No advertising based on mental state. No selling personal mental-state data. No employer access to individual wellbeing information.

## Data export ✅

`apps/mobile/src/lib/privacy.ts` → `exportUserData()`. Entirely client-side — no server function needed, because every collection already grants the owning user read access to their own documents via per-document permissions (set at write time). The export:
1. Reads every collection for the current user
2. Bundles into a single JSON file with an `exportedAt` timestamp
3. Writes it via `expo-file-system` and opens the native share sheet (`expo-sharing`) so the user chooses where it goes (Drive, email, etc. — the app never uploads it anywhere itself)

Verified on-device: real file generated (`personal-os-export-<timestamp>.json`), real Android share sheet appeared with the file attached.

## Account deletion ✅

`functions/process-mental-inbox` with `action: 'delete_account'` (see `docs/ARCHITECTURE.md` for why this lives in that function rather than a dedicated one). Deletes, in order:
1. Every document across all 20 collections where `userId` matches the caller (paginated deletion, not a single-page assumption)
2. Every `audit_logs` entry where `actorId` matches the caller
3. The Appwrite auth account itself (`Users.delete()`)

**Security note**: the user ID acted on is taken from Appwrite's own `x-appwrite-user-id` header (populated server-side for authenticated sessions), never from the request body — a caller can only ever delete their *own* account this way.

Verified with a throwaway test account (not the real dev account, to avoid destroying accumulated test data): created a user + 2 documents via the server SDK, obtained a real session via `Users.createSession()`, called the function as that user, confirmed both the documents and the user account were gone afterward.

The mobile UI (`app/(tabs)/you.tsx`) gates this behind a native confirmation dialog (`Alert.alert`, destructive style) describing exactly what will be lost and that it's irreversible.

## Permission model

Every collection uses `documentSecurity: true`. Collection-level permissions only ever grant `create` to authenticated users (`Role.users()`); every `read`/`update`/`delete` right is granted per-document at write time to the owning user only (`Permission.read/update/delete(Role.user(userId))`). This means:
- No cross-user data leakage is possible via the client SDK, by construction — a user literally cannot query another user's documents, permissions deny it server-side regardless of client code.
- Collections marked `serverOnly` in `packages/appwrite/schema.ts` (e.g. `insights`, `state_estimates`, `memory_items`, `safety_events`, `audit_logs`) restrict *creation* to server (API-key) callers, but the owning user can still read their own documents in most of them (transparency — "why am I seeing this") with the exception of `audit_logs`, which is server/admin-only end to end.

## Not yet built

- **Privacy modes** (Maximum Privacy / Balanced / Maximum Intelligence from the spec) — the `profiles` collection has a `privacyMode` field in the schema, but no UI or behavioral gating reads it yet.
- **Per-source disconnect/delete** (e.g. "delete just my health data") — full account deletion works; granular per-integration deletion doesn't exist yet because no health/calendar integrations are connected yet either.
- **AI Data Firewall** (redaction before cloud AI calls) — the check-in and mental-inbox flows already send only minimal structured/short-text data, but there's no dedicated PII-scrubbing layer yet; `packages/ai/src/evidence.ts` has a `summarizeForCloud()` stub for calendar-density minimization, unused so far since no calendar integration exists.
