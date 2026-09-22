import { functions } from './appwrite';

export interface NotificationLearningResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  learning?: { daysWithCheckin: number; lookbackDays: number; responseRate: number; recommendation: 'reduce' | 'keep'; message: string };
  error?: string;
}

export async function fetchReminderLearning(reminderEnabled: boolean): Promise<NotificationLearningResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'notification_learning', reminderEnabled }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}
