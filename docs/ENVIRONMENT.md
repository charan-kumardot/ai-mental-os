# Environment variables

Root `.env` (copy from `.env.example`) — used by provisioning/dev scripts under `packages/appwrite/scripts` and by the Appwrite Functions deploy scripts (which read it and push relevant values into each function's own environment):

| Variable | Required | Purpose | Where to get it |
|---|---|---|---|
| `APPWRITE_ENDPOINT` | Yes | Appwrite API base URL | Your Appwrite project settings |
| `APPWRITE_PROJECT_ID` | Yes | Appwrite project ID | Your Appwrite project settings |
| `APPWRITE_API_KEY` | Yes | Server API key (full access) — used for schema provisioning and inside deployed Functions | Appwrite Console → your project → API Keys |
| `GROQ_API_KEY` | Yes | Primary, working AI provider — text + speech-to-text | console.groq.com |
| `OPENROUTER_API_KEY` | Optional | Fallback AI provider — **currently has no purchased credits**, see `docs/AI.md` | openrouter.ai |
| `GEMINI_API_KEY` | Not used yet | Provided but no call sites exist | — |
| `OLLAMA_CLOUD_API_KEY` | Not used yet | Provided but no call sites exist | — |
| `ZAI_API_KEY` | Not used yet | Provided but no call sites exist | — |
| `RESEND_API_KEY` | Not used yet | No transactional email sending built yet | — |
| `VERCEL_TOKEN` | Not used yet | No web app deployed yet | — |
| `RENDER_TOKEN` | Not used yet | No separate backend service deployed (Appwrite Functions cover this) | — |

`apps/mobile/.env` (separate, mobile-only — these are **not secret**, they're needed client-side for the Appwrite client SDK to know where to connect):

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_APPWRITE_ENDPOINT` | Yes | Same Appwrite endpoint as above |
| `EXPO_PUBLIC_APPWRITE_PROJECT_ID` | Yes | Same Appwrite project ID as above |

Never put `APPWRITE_API_KEY` (the server key) into `apps/mobile/.env` or any `EXPO_PUBLIC_*` variable — those get bundled into the client and are visible to anyone who inspects the app.
