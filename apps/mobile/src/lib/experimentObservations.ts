import { functions } from './appwrite';

export async function logExperimentObservations(experimentId: string) {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'log_experiment_observations', experimentId }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}
