import { databases, DB_ID, COLLECTIONS, ID, Query, Permission, Role } from './appwrite';

export type InterventionType = 'breathing' | 'movement' | 'sensory' | 'cognitive' | 'social' | 'rest';
export type InterventionFeedback = 'helped' | 'no_effect' | 'made_worse' | 'not_completed';

export interface InterventionDef {
  id: string;
  type: InterventionType;
  title: string;
  description: string;
  durationMinutes: number;
  custom?: boolean;
}

// A small starter set of short, low-risk, generally-applicable techniques —
// not a diagnosis or a treatment plan, just things worth trying. Framed as
// "some people find helpful," never as guaranteed to work for this user.
// What actually works for THIS user is learned from their own feedback below
// (see computeAutopilotRanking), not asserted up front.
export const STATIC_INTERVENTIONS: InterventionDef[] = [
  {
    id: 'box-breathing',
    type: 'breathing',
    title: 'Box breathing',
    description: 'Inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat four times.',
    durationMinutes: 2,
  },
  {
    id: 'physiological-sigh',
    type: 'breathing',
    title: 'Physiological sigh',
    description: 'Two quick inhales through the nose, then one long, slow exhale through the mouth. Repeat 3-5 times.',
    durationMinutes: 2,
  },
  {
    id: 'short-walk',
    type: 'movement',
    title: 'Step outside for a bit',
    description: 'A short walk, phone left behind if you can manage it.',
    durationMinutes: 10,
  },
  {
    id: 'stand-and-stretch',
    type: 'movement',
    title: 'Stand and stretch',
    description: 'A couple of minutes of stretching, wherever you are right now.',
    durationMinutes: 2,
  },
  {
    id: 'cold-water',
    type: 'sensory',
    title: 'Cold water on your face or wrists',
    description: 'A quick physical reset when things feel like too much at once.',
    durationMinutes: 1,
  },
  {
    id: 'grounding-54321',
    type: 'sensory',
    title: '5-4-3-2-1 grounding',
    description: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.',
    durationMinutes: 3,
  },
  {
    id: 'name-the-feeling',
    type: 'cognitive',
    title: 'Name the feeling',
    description: "Say or write what you're feeling, without trying to fix it yet.",
    durationMinutes: 3,
  },
  {
    id: 'brain-dump',
    type: 'cognitive',
    title: 'Brain dump',
    description: "Write down everything in your head for 5 minutes, unfiltered. Don't edit as you go.",
    durationMinutes: 5,
  },
  {
    id: 'message-someone',
    type: 'social',
    title: 'Message one person',
    description: "Doesn't have to be about how you feel — just reach out to someone.",
    durationMinutes: 3,
  },
  {
    id: 'glass-of-water',
    type: 'rest',
    title: 'Drink a glass of water',
    description: 'Small, easy, and purely physiological.',
    durationMinutes: 1,
  },
];

export const TYPE_LABEL: Record<InterventionType, string> = {
  breathing: 'Breathing',
  movement: 'Movement',
  sensory: 'Sensory',
  cognitive: 'Cognitive',
  social: 'Social',
  rest: 'Rest',
};

export async function listCustomInterventions(userId: string): Promise<InterventionDef[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.interventions, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
  ]);
  return res.documents.map((d: any) => ({
    id: d.$id,
    type: (d.type as InterventionType) || 'cognitive',
    title: d.title,
    description: d.description || '',
    durationMinutes: 0,
    custom: true,
  }));
}

export async function createCustomIntervention(
  userId: string,
  input: { type: InterventionType; title: string; description?: string }
) {
  return databases.createDocument(
    DB_ID,
    COLLECTIONS.interventions,
    ID.unique(),
    { userId, type: input.type, title: input.title, description: input.description || undefined },
    [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
}

export async function startIntervention(userId: string, interventionId: string, contextSnapshot?: string) {
  return databases.createDocument(
    DB_ID,
    COLLECTIONS.interventionResults,
    ID.unique(),
    {
      userId,
      interventionId,
      contextSnapshot: contextSnapshot || undefined,
      startedAt: new Date().toISOString(),
    },
    [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
}

export async function completeIntervention(resultId: string, feedback: InterventionFeedback, actualOutcome?: string) {
  return databases.updateDocument(DB_ID, COLLECTIONS.interventionResults, resultId, {
    userFeedback: feedback,
    actualOutcome: actualOutcome || undefined,
    completedAt: new Date().toISOString(),
  });
}

export async function abandonIntervention(resultId: string) {
  return databases.deleteDocument(DB_ID, COLLECTIONS.interventionResults, resultId);
}

export async function listInterventionResults(userId: string) {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.interventionResults, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);
  return res.documents;
}

export interface AutopilotEntry {
  interventionId: string;
  attempts: number;
  helped: number;
  helpRate: number;
}

// Deterministic, not AI — same cost-aware-ladder principle as the insight
// gating elsewhere: don't surface a "ranking" from too little evidence.
const MIN_ATTEMPTS_PER_INTERVENTION = 2;
const MIN_TOTAL_FEEDBACK_FOR_AUTOPILOT = 3;

export function computeAutopilotRanking(results: any[]): { ready: boolean; ranked: AutopilotEntry[] } {
  const withFeedback = results.filter((r) => r.userFeedback);
  if (withFeedback.length < MIN_TOTAL_FEEDBACK_FOR_AUTOPILOT) {
    return { ready: false, ranked: [] };
  }
  const byIntervention = new Map<string, { attempts: number; helped: number }>();
  for (const r of withFeedback) {
    const entry = byIntervention.get(r.interventionId) || { attempts: 0, helped: 0 };
    entry.attempts += 1;
    if (r.userFeedback === 'helped') entry.helped += 1;
    byIntervention.set(r.interventionId, entry);
  }
  const ranked = Array.from(byIntervention.entries())
    .filter(([, v]) => v.attempts >= MIN_ATTEMPTS_PER_INTERVENTION)
    .map(([interventionId, v]) => ({
      interventionId,
      attempts: v.attempts,
      helped: v.helped,
      helpRate: v.helped / v.attempts,
    }))
    .sort((a, b) => b.helpRate - a.helpRate || b.attempts - a.attempts);
  return { ready: ranked.length > 0, ranked };
}

export function findIntervention(id: string, custom: InterventionDef[]): InterventionDef | undefined {
  return STATIC_INTERVENTIONS.find((i) => i.id === id) || custom.find((i) => i.id === id);
}
