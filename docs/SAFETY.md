# Safety

## What exists

An independent Safety Engine (`functions/process-mental-inbox/src/safety.js`) runs **before any other processing** on every piece of free-text or transcribed-voice input in the app (mental inbox entries and voice reflections — check-ins are a fixed 5-point mood tap with no free text, so there's no injection surface there).

It is **deterministic, not AI-based**: a set of regex patterns for self-harm/suicide language (`kill myself`, `end my life`, `want to die`, `suicidal`, `self-harm`, `cut myself`, `better off dead`, `no reason to live`, `can't go on`, `overdose`, etc.) and a separate category for harm-to-others language. This is a first-pass net, deliberately biased toward over-flagging — a false positive costs a gentle redirect; a false negative costs far more.

Unit tested in `functions/process-mental-inbox/src/safety.test.js` (9 cases, including that ordinary difficult-day language and idiomatic phrases like "I could kill for a coffee" do *not* false-positive).

## What happens when flagged

1. The flagged content is **never** sent to an LLM or saved to `mental_inbox`/`voice_reflections`.
2. A `safety_events` document is written (category, severity, `actionTaken: 'showed_safety_response'`) — read-only for the user (audit trail they can see but not delete), write-only for the server.
3. The client shows a minimized, distraction-free screen (just the orb in an "uncertainty" state + the message + one button) — matching the principle "the worse the user feels, the less the app should ask of them."
4. The response text (`safetyResponse()` in `safety.js`) is deliberately:
   - Non-diagnostic ("that sounds like a lot to be carrying," never "you appear to be suicidal")
   - Never claims to be sufficient support itself (no "I'm all you need" — see spec's AI Dependency Guard)
   - Points to region-agnostic real resources: local emergency services, and [findahelpline.com](https://findahelpline.com) (a real, legitimate crisis-line aggregator by country) rather than guessing a single hotline number that may be wrong for the user's actual location
   - Encourages real human connection

## Verified on-device

This was tested against the real running app (not just unit tests) with the literal input *"I want to kill myself, I can't do this anymore"* — confirmed: correctly flagged, safety response shown, `safety_events` document written with `category: self_harm_risk, severity: high`.

## Known limitations, honestly

- **Keyword-based means it's beatable** — someone determined to say something harmful without matching these patterns will get through to normal processing. A secondary LLM-based classification pass (lower priority, catches paraphrases) is not yet built.
- **No escalation path beyond the in-app message** — there's no mechanism to notify an emergency contact or a human moderator. The spec explicitly scopes this app as not a crisis-intervention service; the response correctly redirects to real emergency services rather than pretending to handle the situation itself, but there is no automated follow-up.
- **English-only patterns** — no localization of the detection patterns yet.
