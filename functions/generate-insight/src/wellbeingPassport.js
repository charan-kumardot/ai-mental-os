const { Query } = require('node-appwrite');

const DB_ID = 'personal_os';

const BUILTIN_TITLES = {
  'box-breathing': 'Box breathing',
  'physiological-sigh': 'Physiological sigh',
  'short-walk': 'Step outside for a bit',
  'stand-and-stretch': 'Stand and stretch',
  'cold-water': 'Cold water on your face or wrists',
  'grounding-54321': '5-4-3-2-1 grounding',
  'name-the-feeling': 'Name the feeling',
  'brain-dump': 'Brain dump',
  'message-someone': 'Message one person',
  'glass-of-water': 'Drink a glass of water',
};

const PRESSURE_AREA_LABEL = {
  work: 'Work',
  money: 'Money',
  relationships: 'Relationships',
  health: 'Health',
  sleep: 'Sleep',
  uncertainty: 'Uncertainty',
  decisions: 'Decisions',
  social: 'Social',
};

/**
 * Personal Wellbeing Passport (spec §15/20) — "MY PERSONAL WELLBEING
 * MANUAL." Deliberately has no AI call at all: every section is a real,
 * already-computed or already-stored fact reorganized into one document,
 * not a new synthesis — matching the "rules before AI" principle by not
 * needing AI in the first place here. PDF export is intentionally out of
 * scope for this pass (it would need a new native dependency, `expo-print`,
 * and this session already hit real native-build fragility once); this
 * produces a structured, shareable text document instead.
 */
async function buildWellbeingPassport(databases, userId, log) {
  const [customRes, resultsRes, playbooksRes, pressureRes, experimentsRes, patternsRes] = await Promise.all([
    databases.listDocuments(DB_ID, 'interventions', [Query.equal('userId', userId), Query.limit(50)]),
    databases.listDocuments(DB_ID, 'intervention_results', [Query.equal('userId', userId), Query.limit(200)]),
    databases.listDocuments(DB_ID, 'playbooks', [Query.equal('userId', userId), Query.limit(50)]),
    databases.listDocuments(DB_ID, 'pressure_tags', [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(200)]),
    databases.listDocuments(DB_ID, 'experiments', [Query.equal('userId', userId), Query.limit(50)]),
    databases.listDocuments(DB_ID, 'patterns', [Query.equal('userId', userId), Query.equal('status', 'active'), Query.limit(20)]),
  ]);

  const titleFor = (id) => BUILTIN_TITLES[id] || customRes.documents.find((d) => d.$id === id)?.title || 'a technique';

  // What helps me / what doesn't — grouped from real feedback, same
  // helped/attempts counting convention used by the autopilot ranking.
  const byIntervention = new Map();
  for (const r of resultsRes.documents) {
    if (!r.userFeedback) continue;
    const entry = byIntervention.get(r.interventionId) || { title: titleFor(r.interventionId), helped: 0, attempts: 0, madeWorse: 0 };
    entry.attempts += 1;
    if (r.userFeedback === 'helped') entry.helped += 1;
    if (r.userFeedback === 'made_worse') entry.madeWorse += 1;
    byIntervention.set(r.interventionId, entry);
  }
  const ranked = Array.from(byIntervention.values());
  const whatHelps = ranked.filter((e) => e.attempts >= 2 && e.helped / e.attempts >= 0.5).sort((a, b) => b.helped / b.attempts - a.helped / a.attempts);
  const whatDrains = ranked.filter((e) => e.madeWorse > 0 || (e.attempts >= 2 && e.helped === 0));

  // Pressure patterns / early warning signs — real tag frequency, last 30 days.
  const cutoff = Date.now() - 30 * 86400000;
  const pressureCounts = new Map();
  const recentAreas = new Set();
  for (const p of pressureRes.documents) {
    const created = new Date(p.$createdAt).getTime();
    if (created < cutoff) continue;
    pressureCounts.set(p.area, (pressureCounts.get(p.area) || 0) + 1);
    if (Date.now() - created < 7 * 86400000) recentAreas.add(p.area);
  }
  const pressurePatterns = Array.from(pressureCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([area, count]) => ({ area: PRESSURE_AREA_LABEL[area] || area, count, active: recentAreas.has(area) }));

  const currentExperiments = experimentsRes.documents.filter((e) => e.status === 'active' || e.status === 'proposed').map((e) => e.hypothesis);
  const thingsLearned = patternsRes.documents.map((p) => p.description);
  const playbooks = playbooksRes.documents.map((p) => ({ trigger: p.trigger, steps: p.steps }));

  return {
    skipped: false,
    generatedAt: new Date().toISOString(),
    whatHelps: whatHelps.map((e) => ({ title: e.title, helped: e.helped, attempts: e.attempts })),
    whatDrains: whatDrains.map((e) => ({ title: e.title, helped: e.helped, attempts: e.attempts, madeWorse: e.madeWorse })),
    playbooks,
    pressurePatterns,
    currentExperiments,
    thingsLearned,
  };
}

module.exports = { buildWellbeingPassport };
