import * as SecureStore from 'expo-secure-store';

export type NeedChoice = 'listen' | 'understand' | 'solve' | 'decide' | 'calm' | 'next_step' | 'said_it';

const KEY = 'need_chooser_counts_v1';
const MIN_USES_BEFORE_SKIPPING = 5;
const DOMINANCE_RATIO = 0.7;

async function readCounts(): Promise<Record<string, number>> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Learns the user's preferred "what do you need from me?" answer (spec §6:
 * "do not repeat once sufficiently understood") purely on-device — this is
 * a UX personalization convenience, not meaningful enough on its own to
 * warrant a new synced backend field. Once one choice clearly dominates
 * (70%+ of at least 5 real answers), the chooser stops asking and goes
 * straight to that choice; it re-asks again if the user ever picks
 * something else, so a change of heart isn't locked in forever.
 */
export async function recordNeedChoice(choice: NeedChoice) {
  const counts = await readCounts();
  counts[choice] = (counts[choice] || 0) + 1;
  await SecureStore.setItemAsync(KEY, JSON.stringify(counts)).catch(() => {});
}

export async function getDominantNeedChoice(): Promise<NeedChoice | null> {
  const counts = await readCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total < MIN_USES_BEFORE_SKIPPING) return null;
  const [topChoice, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (topCount / total >= DOMINANCE_RATIO) return topChoice as NeedChoice;
  return null;
}

/**
 * Adaptive AI Communication (spec §36) — length/tone are explicitly
 * user-set here rather than silently inferred from behavior (this app has
 * no reliable passive signal like reading time to learn it from), then
 * threaded into real AI prompts as an actual instruction, not just a
 * cosmetic setting. Kept on-device, same reasoning as the need-chooser
 * preference above.
 */
export type CommunicationLength = 'short' | 'detailed';
export type CommunicationTone = 'direct' | 'gentle';

const STYLE_KEY = 'communication_style_v1';

export interface CommunicationStyle {
  length: CommunicationLength;
  tone: CommunicationTone;
}

const DEFAULT_STYLE: CommunicationStyle = { length: 'short', tone: 'gentle' };

export async function getCommunicationStyle(): Promise<CommunicationStyle> {
  try {
    const raw = await SecureStore.getItemAsync(STYLE_KEY);
    return raw ? { ...DEFAULT_STYLE, ...JSON.parse(raw) } : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

export async function setCommunicationStyle(style: CommunicationStyle) {
  await SecureStore.setItemAsync(STYLE_KEY, JSON.stringify(style)).catch(() => {});
}
