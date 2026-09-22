# Getting from here to a real, installable app

Everything in this repo has been verified running through Expo Go, which is the fastest way to develop but is **not what you ship** — Expo Go is a shared container app; your users need their own installable build. Getting there requires one thing this environment genuinely cannot do: **interactive browser login to an Expo account**, needed to use EAS Build. Everything else below you can run yourself in a few minutes.

## Why EAS Build, not a local build

This dev environment has no Android SDK installed, so a local `expo run:android` isn't possible here. **EAS Build runs in Expo's cloud** — you don't need Android Studio or Xcode on your own machine either. It's the right path regardless of what machine you're on.

## Steps (run these yourself)

```bash
cd apps/mobile
npm install -g eas-cli
eas login                     # opens a browser — log in or create a free Expo account
eas build:configure           # creates eas.json, links this project to your Expo account
```

This will ask to overwrite `app.json`'s `android.package` / `ios.bundleIdentifier` slots or confirm them — the values already set (`com.aimentalos.app`) are placeholders; **change them** to something you actually own before a real release (reverse-DNS of a domain you control, e.g. `com.yourname.personalos`).

### First build (internal testing — installs like a normal APK)

```bash
eas build --platform android --profile preview
```

This produces a downloadable `.apk` you can install directly on any Android phone (no Play Store needed) — the fastest way to get this onto your own phone as a real app icon, not Expo Go. Takes a few minutes on Expo's build servers; you'll get a link when it's done.

### What changes once you have a real build (vs. Expo Go)

- **Push notifications work** — `apps/mobile/src/lib/notifications.ts` is already written; re-wire the daily-reminder toggle back into `app/(tabs)/you.tsx` (see git history / `docs/STATUS.md` for what that UI looked like) once you're testing on a real build, since `expo-notifications` only crashes inside Expo Go, not in a real build.
- **Health Connect / HealthKit become possible** — these need native modules that Expo Go doesn't include. Once you have a dev-client or production build, `expo-health-connect`-family packages can actually run.
- **Your custom app icon shows up** — Expo Go always displays its own icon for hosted projects; the real icon set generated this session (`apps/mobile/assets/icon.png` and friends) only appears in an actual build.

### Play Store release (when ready)

```bash
eas build --platform android --profile production
eas submit --platform android
```

`eas submit` needs a Google Play Console developer account (one-time $25 fee) and a service account key — follow the prompts, or see [Expo's submission docs](https://docs.expo.dev/submit/android/).

### iOS

Same commands with `--platform ios`, but you'll need an active Apple Developer Program membership ($99/year) before `eas build` or `eas submit` will succeed — Apple requires this to sign the build, EAS can't work around it.

## Before you actually put this in front of real users

Beyond the build itself, genuinely finish these first (see `docs/STATUS.md` "Still not started" for the full list, but these three matter most for user trust in a mental-health app specifically):

1. **Change the bundle identifier / package name** from the placeholder (`com.aimentalos.app`) to something you own.
2. **Rotate the API keys** that were pasted into this conversation in plaintext (Appwrite server key especially) — see `docs/ENVIRONMENT.md`. They've already been used to provision real cloud resources; treat them as potentially exposed.
3. **Read `docs/SAFETY.md`'s "Known limitations" section** and decide if the keyword-based safety net is sufficient for your actual launch, or whether you want a secondary AI-based classification pass before real users rely on this.
