export interface ContextModeOption {
  key: string;
  label: string;
  group: 'life_event' | 'contextual';
  durationDays: number;
}

/**
 * Life Event Mode + Contextual Modes (spec §17-18) — combined into one
 * flat, user-set list since both are the same underlying mechanism
 * (a temporary, self-expiring context label on the profile). Always
 * user-selected, never auto-detected from behavior — the spec is explicit
 * that normal transitions should never be pathologized by inference.
 */
export const CONTEXT_MODE_OPTIONS: ContextModeOption[] = [
  { key: 'new_job', label: 'New job', group: 'life_event', durationDays: 21 },
  { key: 'moving', label: 'Moving', group: 'life_event', durationDays: 21 },
  { key: 'exam_period', label: 'Exam period', group: 'life_event', durationDays: 14 },
  { key: 'travel', label: 'Travel', group: 'life_event', durationDays: 10 },
  { key: 'major_project', label: 'Major project', group: 'life_event', durationDays: 21 },
  { key: 'relationship_change', label: 'Relationship change', group: 'life_event', durationDays: 21 },
  { key: 'financial_pressure', label: 'Financial pressure', group: 'life_event', durationDays: 30 },
  { key: 'grief', label: 'Grief', group: 'life_event', durationDays: 30 },
  { key: 'sleep_recovery', label: 'Sleep recovery', group: 'contextual', durationDays: 7 },
  { key: 'work_pressure', label: 'Work pressure', group: 'contextual', durationDays: 7 },
  { key: 'social_overload', label: 'Social overload', group: 'contextual', durationDays: 5 },
  { key: 'decision_overload', label: 'Decision overload', group: 'contextual', durationDays: 5 },
  { key: 'focus_collapse', label: 'Focus collapse', group: 'contextual', durationDays: 5 },
  { key: 'emotional_recovery', label: 'Emotional recovery', group: 'contextual', durationDays: 7 },
];

export function isContextModeActive(profile?: { activeContextMode?: string; activeContextExpiresAt?: string } | null) {
  if (!profile?.activeContextMode || !profile.activeContextExpiresAt) return false;
  return new Date(profile.activeContextExpiresAt).getTime() > Date.now();
}

export function daysRemaining(expiresAt?: string): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}
