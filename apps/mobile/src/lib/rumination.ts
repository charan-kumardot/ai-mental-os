/**
 * Anti-Rumination Engine (spec §6) — a deterministic, real signal: 3 or
 * more "emotional" category Mental Inbox entries in the last 7 days that
 * are still unresolved. Never inspects entry text for semantic similarity
 * (no NLP available here) — frequency-without-resolution is itself a real,
 * honest signal that doesn't require guessing whether the topic is
 * literally "the same," and never labels the person negatively.
 */
export function detectRumination(
  items: { category?: string; resolved?: boolean; $createdAt: string }[],
  referenceDate: Date = new Date()
): boolean {
  const cutoff = referenceDate.getTime() - 7 * 86400000;
  const recentUnresolvedEmotional = items.filter(
    (i) => i.category === 'emotional' && !i.resolved && new Date(i.$createdAt).getTime() >= cutoff
  );
  return recentUnresolvedEmotional.length >= 3;
}
