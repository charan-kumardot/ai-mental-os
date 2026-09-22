import { databases, DB_ID, COLLECTIONS, ID, Permission, Role, Query } from './appwrite';

export const PRESSURE_AREAS = ['work', 'money', 'relationships', 'health', 'sleep', 'uncertainty', 'decisions', 'social'] as const;
export type PressureArea = (typeof PRESSURE_AREAS)[number];

export const PRESSURE_AREA_LABEL: Record<PressureArea, string> = {
  work: 'Work',
  money: 'Money',
  relationships: 'Relationships',
  health: 'Health',
  sleep: 'Sleep',
  uncertainty: 'Uncertainty',
  decisions: 'Decisions',
  social: 'Social',
};

/** Spec §64 — always self-reported by the user tapping an area, never
 * inferred from other data ("Do not infer sensitive categories without
 * evidence"). */
export async function tagPressure(userId: string, area: PressureArea) {
  return databases.createDocument(DB_ID, COLLECTIONS.pressureTags, ID.unique(), { userId, area }, [
    Permission.read(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ]);
}

export interface PressureTrend {
  area: PressureArea;
  count: number;
}

/** Pure aggregation over real tag documents — a count per area within the
 * lookback window, nothing inferred or smoothed. */
export function computePressureTrends(docs: any[], lookbackDays = 30): PressureTrend[] {
  const cutoff = Date.now() - lookbackDays * 86400000;
  const counts = new Map<string, number>();
  for (const d of docs) {
    if (new Date(d.$createdAt).getTime() < cutoff) continue;
    counts.set(d.area, (counts.get(d.area) ?? 0) + 1);
  }
  return PRESSURE_AREAS.map((area) => ({ area, count: counts.get(area) ?? 0 })).sort((a, b) => b.count - a.count);
}

export async function listPressureTags(userId: string) {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.pressureTags, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ]);
  return res.documents;
}
