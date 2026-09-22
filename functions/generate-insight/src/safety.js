/**
 * Independent Safety Engine (spec section 61) — runs BEFORE any content is
 * made visible to other users. Deterministic and keyword-based by design:
 * a safety gate must be fast, auditable, and not depend on an LLM being
 * available or behaving predictably. This is a first-pass net, not a
 * clinical instrument — it is deliberately biased toward over-flagging
 * (false positives cost a gentle redirect; false negatives cost far more).
 *
 * Duplicated from functions/process-mental-inbox/src/safety.js per this
 * project's established convention: each Appwrite Function ships its own
 * self-contained copy of shared logic, since Appwrite's isolated build
 * environment can't resolve monorepo workspace imports across functions.
 * Keep both copies in sync if the classification rules change.
 *
 * This module never diagnoses, never gives medical/safety instructions,
 * and never claims certainty. It only decides: does this input get
 * blocked from becoming visible to others and get the safety response
 * instead?
 */

const SELF_HARM_PATTERNS = [
  /\bkill(ing)?\s+myself\b/i,
  /\bend(ing)?\s+my\s+life\b/i,
  /\bwant(ed)?\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+alive|live|exist)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bself[\s-]?harm(ing)?\b/i,
  /\bcut(ting)?\s+myself\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bno\s+reason\s+to\s+(live|go\s+on)\b/i,
  /\bcan'?t\s+(go\s+on|do\s+this\s+anymore|keep\s+going)\b/i,
  /\b(overdose|od'?ing)\b/i,
  /\bhurt(ing)?\s+myself\b/i,
  /\bplan(ning)?\s+to\s+(die|end\s+it)\b/i,
];

const CRISIS_OTHERS_PATTERNS = [
  /\bkill(ing)?\s+(him|her|them|someone)\b/i,
  /\bhurt(ing)?\s+(him|her|them|someone)\b/i,
];

function classify(text) {
  const t = text || '';
  for (const pattern of SELF_HARM_PATTERNS) {
    if (pattern.test(t)) {
      return { flagged: true, category: 'self_harm_risk', severity: 'high' };
    }
  }
  for (const pattern of CRISIS_OTHERS_PATTERNS) {
    if (pattern.test(t)) {
      return { flagged: true, category: 'harm_to_others_risk', severity: 'high' };
    }
  }
  return { flagged: false };
}

/**
 * Warm, plain-language, non-clinical. Never: "I'm concerned you are
 * suicidal" (diagnostic framing), never dangerous instructions, never
 * "I'm all you need" (spec section 62 — protect real human connection).
 * Points to a country-agnostic resource rather than guessing a hotline
 * number that may be wrong for the user's actual location.
 */
function safetyResponse(category) {
  const base =
    "That sounds like a lot to be carrying. I'm not the right kind of support for this — a person can help in ways I can't.";
  if (category === 'harm_to_others_risk') {
    return `${base} If anyone is in immediate danger, please contact your local emergency services right now. If you can, reach out to someone you trust or a crisis line in your area — findahelpline.com lists options by country.`;
  }
  return `${base} If you're in immediate danger, please contact your local emergency services right now. You can also find a crisis line for your country at findahelpline.com. If it feels safe to, reaching out to someone you trust — even just to not be alone with this — can help too.`;
}

module.exports = { classify, safetyResponse };
