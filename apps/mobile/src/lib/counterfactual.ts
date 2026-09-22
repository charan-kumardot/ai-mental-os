import { Pattern } from './patterns';

const DIMENSION_DISPLAY: Record<string, string> = {
  mood: 'your mood',
  sleepMinutes: 'your sleep',
  steps: 'your steps',
  meetingCount: 'your meeting load',
  meetingMinutes: 'your meeting load',
};

const DIMENSION_ACTION: Record<string, string> = {
  mood: 'feel better',
  sleepMinutes: 'sleep more',
  steps: 'move more',
  meetingCount: 'have fewer meetings',
  meetingMinutes: 'protect more open time',
};

export interface Counterfactual {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  evidenceCount: number;
}

/**
 * Spec section 47, "Counterfactual Lab" — entirely deterministic, no AI
 * call: every "what if" question is generated directly from a real,
 * already-gated pattern (same `patterns` data shown on the Brain tab's
 * relationship map), so a counterfactual can only ever exist for a
 * dimension pair that actually cleared the correlation gate. Never
 * presents a hypothetical result as guaranteed — phrasing is fixed and
 * always hedged ("tended to," "appears associated," "no guarantee").
 */
export function buildCounterfactuals(patterns: Pattern[]): Counterfactual[] {
  return patterns.map((p) => {
    const actionDim = DIMENSION_ACTION[p.dimensionA] ? p.dimensionA : p.dimensionB;
    const otherDim = actionDim === p.dimensionA ? p.dimensionB : p.dimensionA;
    const action = DIMENSION_ACTION[actionDim] ?? `change ${DIMENSION_DISPLAY[actionDim] ?? actionDim}`;
    const outcome = DIMENSION_DISPLAY[otherDim] ?? otherDim;
    const direction = p.relationshipType === 'positive' ? 'tended to rise together with' : 'tended to move opposite to';

    return {
      id: p.id,
      question: `What if I ${action}?`,
      answer: `Based on ${p.evidenceCount} days of your own data, ${DIMENSION_DISPLAY[actionDim] ?? actionDim} has ${direction} ${outcome}. That's a real pattern in your history, not a guarantee — it doesn't prove one causes the other, and it may not hold every time.`,
      confidence: p.confidence,
      evidenceCount: p.evidenceCount,
    };
  });
}
