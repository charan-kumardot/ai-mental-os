const { Query, ID, Permission, Role } = require('node-appwrite');
const { buildDayMap, DB_ID } = require('./dayMap');

const BASELINE_WINDOW_DAYS = 7;

/**
 * Structured N-of-1 experiment phases (spec §26) — backfills real
 * baseline-vs-intervention observations from the user's actual records
 * rather than requiring manual daily logging. "Baseline" is the 7 days
 * immediately before the experiment started; "intervention" is the
 * experiment's own start-to-end window. Only ever reads dimensions the
 * user explicitly selected to measure, and only writes a day that
 * actually has real data for at least one of them — never an invented
 * data point to fill a gap.
 */
async function logExperimentObservations(databases, userId, experimentId, log) {
  const experiment = await databases.getDocument(DB_ID, 'experiments', experimentId);
  if (experiment.userId !== userId) {
    throw new Error('Experiment does not belong to this user');
  }

  const measuredDimensions = experiment.measuredDimensions?.length ? experiment.measuredDimensions : ['mood', 'sleepMinutes', 'steps', 'meetingCount'];
  const startedAt = experiment.startedAt ? new Date(experiment.startedAt) : null;
  const endedAt = experiment.endedAt ? new Date(experiment.endedAt) : new Date();
  if (!startedAt) {
    return { skipped: true, reason: 'no_start_date', message: 'This experiment has no start date to measure from.' };
  }

  const baselineStart = new Date(startedAt.getTime() - BASELINE_WINDOW_DAYS * 86400000);
  const dayMap = await buildDayMap(databases, userId, { limit: 300 });

  const writes = [];
  let baselineCount = 0;
  let interventionCount = 0;

  for (const [dateKey, values] of Object.entries(dayMap)) {
    const date = new Date(dateKey);
    const picked = {};
    for (const dim of measuredDimensions) {
      if (values[dim] != null) picked[dim] = values[dim];
    }
    if (Object.keys(picked).length === 0) continue;

    let phase = null;
    if (date >= baselineStart && date < startedAt) phase = 'baseline';
    else if (date >= startedAt && date <= endedAt) phase = 'intervention';
    if (!phase) continue;

    const docId = `${experimentId}_${dateKey}`;
    const data = { userId, experimentId, date: dateKey, phase, values: JSON.stringify(picked) };
    const perms = [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))];
    writes.push(
      databases
        .updateDocument(DB_ID, 'experiment_observations', docId, data)
        .catch(() => databases.createDocument(DB_ID, 'experiment_observations', docId, data, perms))
    );
    if (phase === 'baseline') baselineCount++;
    else interventionCount++;
  }

  await Promise.all(writes);

  if (log) log(`logged ${baselineCount} baseline + ${interventionCount} intervention observations for experiment ${experimentId}`);

  return { skipped: false, baselineCount, interventionCount };
}

module.exports = { logExperimentObservations };
