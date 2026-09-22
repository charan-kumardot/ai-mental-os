import { Client, Account, Databases, Functions, Storage, ID, Query, Permission, Role } from 'appwrite';

// The Appwrite web SDK's Realtime client does an unguarded
// `window.localStorage.getItem('cookieFallback')` when a socket first
// connects without a `config.session` set (our mobile auth flow never
// sets one — that's a browser-cookie concept). It's internally
// try/caught, so it never actually breaks anything, but the resulting
// `console.error` trips React Native's dev LogBox into showing a red
// error overlay on every Realtime subscribe. A minimal stub avoids the
// throw entirely rather than just suppressing the resulting log.
const g = globalThis as any;
if (typeof g.window === 'undefined') g.window = g;
if (typeof g.window.localStorage === 'undefined') {
  g.window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;

if (!endpoint || !projectId) {
  throw new Error(
    'Missing Appwrite config. Set EXPO_PUBLIC_APPWRITE_ENDPOINT and EXPO_PUBLIC_APPWRITE_PROJECT_ID in apps/mobile/.env'
  );
}

export const client = new Client().setEndpoint(endpoint).setProject(projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const functions = new Functions(client);
export const storage = new Storage(client);

export { ID, Query, Permission, Role };

// Database / collection IDs — must match packages/appwrite/schema.ts exactly.
export const DB_ID = 'personal_os';
export const COLLECTIONS = {
  profiles: 'profiles',
  goals: 'goals',
  consents: 'consents',
  checkins: 'checkins',
  voiceReflections: 'voice_reflections',
  healthData: 'health_data',
  calendarSummaries: 'calendar_summaries',
  baselines: 'baselines',
  stateEstimates: 'state_estimates',
  patterns: 'patterns',
  interventions: 'interventions',
  interventionResults: 'intervention_results',
  experiments: 'experiments',
  insights: 'insights',
  memoryItems: 'memory_items',
  mentalInbox: 'mental_inbox',
  decisions: 'decisions',
  playbooks: 'playbooks',
  notificationsPrefs: 'notification_prefs',
  notificationEvents: 'notification_events',
  safetyEvents: 'safety_events',
  auditLogs: 'audit_logs',
  pressureTags: 'pressure_tags',
  presence: 'presence',
  circles: 'circles',
  circleMembers: 'circle_members',
  circleMessages: 'circle_messages',
  circleModeration: 'circle_moderation',
  liveSessions: 'live_sessions',
  liveSessionParticipants: 'live_session_participants',
} as const;
