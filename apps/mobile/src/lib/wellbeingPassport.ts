import { functions } from './appwrite';

export interface PassportInterventionEntry {
  title: string;
  helped: number;
  attempts: number;
  madeWorse?: number;
}

export interface PassportPressurePattern {
  area: string;
  count: number;
  active: boolean;
}

export interface PassportPlaybook {
  trigger: string;
  steps: string[];
}

export interface WellbeingPassportResult {
  skipped: boolean;
  generatedAt?: string;
  whatHelps?: PassportInterventionEntry[];
  whatDrains?: PassportInterventionEntry[];
  playbooks?: PassportPlaybook[];
  pressurePatterns?: PassportPressurePattern[];
  currentExperiments?: string[];
  thingsLearned?: string[];
  error?: string;
}

export async function fetchWellbeingPassport(): Promise<WellbeingPassportResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'wellbeing_passport' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

export type PassportSectionKey = 'whatHelps' | 'whatDrains' | 'playbooks' | 'pressurePatterns' | 'currentExperiments' | 'thingsLearned';

/** Renders only the sections the user chose (spec §15's "selective sharing"). */
export function renderPassportText(passport: WellbeingPassportResult, includeSections: Set<PassportSectionKey>): string {
  const lines: string[] = ['MY PERSONAL WELLBEING MANUAL', ''];

  if (includeSections.has('whatHelps') && passport.whatHelps?.length) {
    lines.push('WHAT HELPS ME', ...passport.whatHelps.map((e) => `- ${e.title} (helped ${e.helped}/${e.attempts} times)`), '');
  }
  if (includeSections.has('whatDrains') && passport.whatDrains?.length) {
    lines.push('WHAT DRAINS ME', ...passport.whatDrains.map((e) => `- ${e.title}${e.madeWorse ? ' (made things worse before)' : ' (hasn\'t helped so far)'}`), '');
  }
  if (includeSections.has('playbooks') && passport.playbooks?.length) {
    lines.push('MY PLAYBOOKS (when X, do Y)', ...passport.playbooks.map((p) => `- When "${p.trigger}": ${p.steps.join(', ')}`), '');
  }
  if (includeSections.has('pressurePatterns') && passport.pressurePatterns?.length) {
    lines.push(
      'PRESSURE PATTERNS (last 30 days)',
      ...passport.pressurePatterns.map((p) => `- ${p.area}: tagged ${p.count}x${p.active ? ' (still active)' : ''}`),
      ''
    );
  }
  if (includeSections.has('currentExperiments') && passport.currentExperiments?.length) {
    lines.push('CURRENT EXPERIMENTS', ...passport.currentExperiments.map((e) => `- ${e}`), '');
  }
  if (includeSections.has('thingsLearned') && passport.thingsLearned?.length) {
    lines.push('THINGS I\'VE LEARNED ABOUT MYSELF', ...passport.thingsLearned.map((t) => `- ${t}`), '');
  }

  lines.push(`Generated ${passport.generatedAt ? new Date(passport.generatedAt).toLocaleDateString() : ''} — built only from real tracked history, nothing invented.`);
  return lines.join('\n');
}
