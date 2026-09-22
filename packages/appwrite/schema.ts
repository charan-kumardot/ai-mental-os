/**
 * Single source of truth for the Appwrite database schema.
 * Mirrors apps/mobile/src/lib/appwrite.ts COLLECTIONS and DB_ID exactly —
 * keep both in sync when adding a collection.
 *
 * Row-level isolation model: every collection has documentSecurity enabled.
 * Collection-level permissions only allow authenticated users to CREATE;
 * READ/UPDATE/DELETE are granted per-document at write time
 * (Permission.read/update/delete(Role.user(userId))), so one user's rows
 * are never visible to another user. `serverOnly` collections additionally
 * omit the users' create permission — only backend functions (API key auth)
 * may write to them.
 *
 * Exception: the `social` group below (presence, circles, circle_members,
 * circle_messages, live_sessions, live_session_participants) deliberately
 * grants Permission.read(Role.users()) at document-write time — these are
 * the realtime/social layer (spec: Live Wellbeing Presence, Wellbeing
 * Circles, Live Reset Rooms), which only functions at all if other
 * authenticated users can see them. Nothing sensitive lives here: presence
 * is a voluntarily-set status word, circles are topic-based open
 * communities (not private DMs), and live sessions carry no personal
 * health/emotional data — only a session type and timestamp. Every other
 * collection keeps the strict per-user isolation above.
 */

export type AttrType = 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'enum';

export interface AttributeDef {
  key: string;
  type: AttrType;
  size?: number; // required for 'string'
  required: boolean;
  array?: boolean;
  default?: string | number | boolean | null;
  elements?: string[]; // required for 'enum'
}

export interface IndexDef {
  key: string;
  type: 'key' | 'unique' | 'fulltext';
  attributes: string[];
}

export interface CollectionDef {
  id: string;
  name: string;
  attributes: AttributeDef[];
  indexes: IndexDef[];
  serverOnly?: boolean; // only backend (API key) can create/update; users can still read their own rows
}

export const DB_ID = 'personal_os';
export const DB_NAME = 'Personal OS';

export const COLLECTIONS: CollectionDef[] = [
  {
    id: 'profiles',
    name: 'Profiles',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 128, required: false },
      { key: 'ageRange', type: 'string', size: 16, required: false },
      { key: 'timezone', type: 'string', size: 64, required: false },
      { key: 'occupation', type: 'string', size: 128, required: false },
      { key: 'workType', type: 'string', size: 32, required: false },
      { key: 'workingHoursStart', type: 'string', size: 8, required: false },
      { key: 'workingHoursEnd', type: 'string', size: 8, required: false },
      { key: 'sleepScheduleStart', type: 'string', size: 8, required: false },
      { key: 'sleepScheduleEnd', type: 'string', size: 8, required: false },
      { key: 'mode', type: 'enum', elements: ['feel_better', 'perform_better', 'both'], required: false, default: 'both' },
      { key: 'goals', type: 'string', size: 32, required: false, array: true },
      { key: 'interactionStyle', type: 'string', size: 32, required: false },
      { key: 'privacyMode', type: 'enum', elements: ['maximum_privacy', 'balanced', 'maximum_intelligence'], required: false, default: 'balanced' },
      { key: 'onboardingCompleted', type: 'boolean', required: false, default: false },
      { key: 'onboardingStep', type: 'string', size: 32, required: false },
      // Life Event Mode / Contextual Modes (spec §17-18) — a temporary
      // situational context the user sets themselves, never auto-detected
      // from sensitive inference. Self-expires so it never becomes a
      // permanent unnoticed label.
      { key: 'activeContextMode', type: 'string', size: 32, required: false },
      { key: 'activeContextLabel', type: 'string', size: 64, required: false },
      { key: 'activeContextExpiresAt', type: 'datetime', required: false },
    ],
    indexes: [{ key: 'userId_idx', type: 'unique', attributes: ['userId'] }],
  },
  {
    id: 'consents',
    name: 'Consents',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'source', type: 'string', size: 32, required: true },
      { key: 'granted', type: 'boolean', required: true, default: false },
      { key: 'grantedAt', type: 'datetime', required: false },
      { key: 'revokedAt', type: 'datetime', required: false },
    ],
    indexes: [
      { key: 'userId_idx', type: 'key', attributes: ['userId'] },
      { key: 'userId_source_idx', type: 'unique', attributes: ['userId', 'source'] },
    ],
  },
  {
    id: 'checkins',
    name: 'Check-ins',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'mood', type: 'enum', elements: ['great', 'good', 'okay', 'low', 'struggling'], required: true },
      { key: 'energy', type: 'integer', required: false },
      { key: 'stress', type: 'integer', required: false },
      { key: 'focus', type: 'integer', required: false },
      { key: 'note', type: 'string', size: 2000, required: false },
      { key: 'source', type: 'string', size: 16, required: false, default: 'manual' },
    ],
    indexes: [{ key: 'userId_created_idx', type: 'key', attributes: ['userId', '$createdAt'] }],
  },
  {
    id: 'voice_reflections',
    name: 'Voice Reflections',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'transcript', type: 'string', size: 8000, required: true },
      { key: 'intent', type: 'string', size: 32, required: false },
      { key: 'extractedEvent', type: 'string', size: 500, required: false },
      { key: 'extractedEmotion', type: 'string', size: 200, required: false },
      { key: 'extractedConcern', type: 'string', size: 500, required: false },
      { key: 'savedAsMemory', type: 'boolean', required: false, default: false },
    ],
    indexes: [{ key: 'userId_created_idx', type: 'key', attributes: ['userId', '$createdAt'] }],
  },
  {
    id: 'health_data',
    name: 'Health Data',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'date', type: 'string', size: 10, required: true },
      { key: 'sleepMinutes', type: 'integer', required: false },
      { key: 'steps', type: 'integer', required: false },
      { key: 'activeEnergy', type: 'float', required: false },
      { key: 'restingHeartRate', type: 'integer', required: false },
      { key: 'workoutMinutes', type: 'integer', required: false },
      { key: 'source', type: 'string', size: 32, required: false },
    ],
    indexes: [{ key: 'userId_date_idx', type: 'unique', attributes: ['userId', 'date'] }],
  },
  {
    id: 'calendar_summaries',
    name: 'Calendar Summaries',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'date', type: 'string', size: 10, required: true },
      { key: 'meetingCount', type: 'integer', required: false },
      { key: 'meetingMinutes', type: 'integer', required: false },
      { key: 'meetingDensity', type: 'string', size: 16, required: false },
      { key: 'freeWindowMinutes', type: 'integer', required: false },
    ],
    indexes: [{ key: 'userId_date_idx', type: 'unique', attributes: ['userId', 'date'] }],
  },
  {
    id: 'baselines',
    name: 'Baselines',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'dimension', type: 'string', size: 32, required: true },
      { key: 'windowType', type: 'enum', elements: ['short', 'medium', 'long'], required: true },
      { key: 'mean', type: 'float', required: false },
      { key: 'stdDev', type: 'float', required: false },
      { key: 'sampleSize', type: 'integer', required: false, default: 0 },
    ],
    indexes: [{ key: 'userId_dim_window_idx', type: 'unique', attributes: ['userId', 'dimension', 'windowType'] }],
  },
  {
    id: 'state_estimates',
    name: 'State Estimates',
    serverOnly: true,
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'date', type: 'string', size: 10, required: true },
      { key: 'energy', type: 'string', size: 16, required: false },
      { key: 'focus', type: 'string', size: 16, required: false },
      { key: 'stress', type: 'string', size: 16, required: false },
      { key: 'recovery', type: 'string', size: 16, required: false },
      { key: 'mentalLoad', type: 'string', size: 16, required: false },
      { key: 'confidence', type: 'float', required: false },
      { key: 'evidenceIds', type: 'string', size: 64, required: false, array: true },
    ],
    indexes: [{ key: 'userId_date_idx', type: 'unique', attributes: ['userId', 'date'] }],
  },
  {
    id: 'patterns',
    name: 'Patterns',
    serverOnly: true,
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'description', type: 'string', size: 500, required: true },
      { key: 'dimensionA', type: 'string', size: 32, required: false },
      { key: 'dimensionB', type: 'string', size: 32, required: false },
      { key: 'relationshipType', type: 'string', size: 32, required: false },
      { key: 'confidence', type: 'float', required: false },
      { key: 'evidenceCount', type: 'integer', required: false, default: 0 },
      { key: 'contradictingCount', type: 'integer', required: false, default: 0 },
      { key: 'status', type: 'enum', elements: ['active', 'weakened', 'retired'], required: false, default: 'active' },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },
  {
    id: 'interventions',
    name: 'Interventions',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'type', type: 'string', size: 32, required: true },
      { key: 'title', type: 'string', size: 200, required: true },
      { key: 'description', type: 'string', size: 1000, required: false },
      { key: 'contextTags', type: 'string', size: 32, required: false, array: true },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },
  {
    id: 'intervention_results',
    name: 'Intervention Results',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'interventionId', type: 'string', size: 64, required: true },
      { key: 'contextSnapshot', type: 'string', size: 1000, required: false },
      { key: 'expectedOutcome', type: 'string', size: 500, required: false },
      { key: 'actualOutcome', type: 'string', size: 500, required: false },
      { key: 'userFeedback', type: 'enum', elements: ['helped', 'no_effect', 'made_worse', 'not_completed'], required: false },
      { key: 'startedAt', type: 'datetime', required: false },
      { key: 'completedAt', type: 'datetime', required: false },
    ],
    indexes: [
      { key: 'userId_idx', type: 'key', attributes: ['userId'] },
      { key: 'interventionId_idx', type: 'key', attributes: ['interventionId'] },
    ],
  },
  {
    id: 'experiments',
    name: 'Experiments',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'hypothesis', type: 'string', size: 500, required: true },
      { key: 'status', type: 'enum', elements: ['proposed', 'active', 'completed', 'abandoned'], required: false, default: 'proposed' },
      { key: 'durationDays', type: 'integer', required: false },
      { key: 'measuredDimensions', type: 'string', size: 32, required: false, array: true },
      { key: 'conclusion', type: 'string', size: 1000, required: false },
      { key: 'confidence', type: 'float', required: false },
      { key: 'startedAt', type: 'datetime', required: false },
      { key: 'endedAt', type: 'datetime', required: false },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },
  {
    id: 'experiment_observations',
    name: 'Experiment Observations',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'experimentId', type: 'string', size: 64, required: true },
      { key: 'date', type: 'string', size: 10, required: true },
      { key: 'phase', type: 'enum', elements: ['baseline', 'intervention'], required: true },
      { key: 'values', type: 'string', size: 1000, required: false },
    ],
    indexes: [{ key: 'experimentId_idx', type: 'key', attributes: ['experimentId'] }],
  },
  {
    id: 'insights',
    name: 'Insights',
    serverOnly: true,
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 200, required: true },
      { key: 'body', type: 'string', size: 2000, required: true },
      { key: 'category', type: 'string', size: 32, required: false },
      { key: 'evidenceIds', type: 'string', size: 64, required: false, array: true },
      { key: 'confidence', type: 'float', required: false },
      { key: 'seenAt', type: 'datetime', required: false },
    ],
    indexes: [{ key: 'userId_created_idx', type: 'key', attributes: ['userId', '$createdAt'] }],
  },
  {
    id: 'memory_items',
    name: 'Memory Items',
    serverOnly: true,
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'type', type: 'enum', elements: ['episodic', 'semantic', 'pattern', 'intervention', 'experiment'], required: true },
      { key: 'content', type: 'string', size: 2000, required: true },
      { key: 'importance', type: 'float', required: false },
      { key: 'sensitivity', type: 'enum', elements: ['low', 'medium', 'high'], required: false, default: 'medium' },
      { key: 'source', type: 'string', size: 32, required: false },
      { key: 'outdated', type: 'boolean', required: false, default: false },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },
  {
    id: 'mental_inbox',
    name: 'Mental Inbox',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'content', type: 'string', size: 1000, required: true },
      { key: 'category', type: 'enum', elements: ['action', 'decision', 'information', 'conversation', 'emotional', 'defer', 'not_actionable'], required: false },
      { key: 'resolved', type: 'boolean', required: false, default: false },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },
  {
    id: 'decisions',
    name: 'Decisions',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 200, required: true },
      { key: 'knownInfo', type: 'string', size: 1000, required: false },
      { key: 'unknownInfo', type: 'string', size: 1000, required: false },
      { key: 'options', type: 'string', size: 1000, required: false },
      { key: 'nextAction', type: 'string', size: 500, required: false },
      { key: 'resolved', type: 'boolean', required: false, default: false },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },
  {
    id: 'playbooks',
    name: 'Playbooks',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'trigger', type: 'string', size: 100, required: true },
      { key: 'steps', type: 'string', size: 300, required: false, array: true },
      { key: 'effectivenessScore', type: 'float', required: false },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },
  {
    id: 'notification_prefs',
    name: 'Notification Preferences',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'quietHoursStart', type: 'string', size: 8, required: false },
      { key: 'quietHoursEnd', type: 'string', size: 8, required: false },
      { key: 'categoriesEnabled', type: 'string', size: 32, required: false, array: true },
      { key: 'lastNotifiedAt', type: 'datetime', required: false },
    ],
    indexes: [{ key: 'userId_idx', type: 'unique', attributes: ['userId'] }],
  },
  {
    id: 'safety_events',
    name: 'Safety Events',
    serverOnly: true,
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'category', type: 'string', size: 32, required: true },
      { key: 'severity', type: 'string', size: 16, required: false },
      { key: 'actionTaken', type: 'string', size: 200, required: false },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },
  {
    id: 'audit_logs',
    name: 'Audit Logs',
    serverOnly: true,
    attributes: [
      { key: 'actorId', type: 'string', size: 64, required: true },
      { key: 'action', type: 'string', size: 64, required: true },
      { key: 'targetType', type: 'string', size: 32, required: false },
      { key: 'targetId', type: 'string', size: 64, required: false },
    ],
    indexes: [{ key: 'actorId_idx', type: 'key', attributes: ['actorId'] }],
  },
  {
    // Spec §64, "Pressure Map" — always self-reported (the spec is explicit:
    // "Do not infer sensitive categories without evidence"), never AI-guessed
    // from other data. One document per tag-tap; trends are computed by
    // counting real documents over time, not by any inference layer.
    id: 'pressure_tags',
    name: 'Pressure Tags',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      {
        key: 'area',
        type: 'enum',
        elements: ['work', 'money', 'relationships', 'health', 'sleep', 'uncertainty', 'decisions', 'social'],
        required: true,
      },
    ],
    indexes: [{ key: 'userId_idx', type: 'key', attributes: ['userId'] }],
  },

  // ---- Realtime / social layer (spec §41-47) — see the file-level comment
  // above re: the document-read-permission exception these six collections
  // deliberately use. ----
  {
    // Live Wellbeing Presence (spec §41) — a real, voluntarily-set status
    // word, never a mental-health metric. One document per user (upserted),
    // so "who's around right now" is a real, current read, not stale.
    id: 'presence',
    name: 'Presence',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'displayName', type: 'string', size: 64, required: false },
      {
        key: 'status',
        type: 'enum',
        elements: ['available', 'break', 'focusing', 'walking', 'winding_down', 'resetting', 'open_to_talk', 'dnd'],
        required: true,
      },
    ],
    indexes: [{ key: 'userId_idx', type: 'unique', attributes: ['userId'] }],
  },
  {
    // Wellbeing Circles (spec §45) — open, topic-based communities (e.g.
    // "Early Risers"), not private friend groups; anyone can browse and
    // join, matching the spec's own examples.
    id: 'circles',
    name: 'Circles',
    attributes: [
      { key: 'name', type: 'string', size: 64, required: true },
      { key: 'description', type: 'string', size: 200, required: false },
      { key: 'createdBy', type: 'string', size: 64, required: true },
    ],
    indexes: [],
  },
  {
    id: 'circle_members',
    name: 'Circle Members',
    attributes: [
      { key: 'circleId', type: 'string', size: 36, required: true },
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'displayName', type: 'string', size: 64, required: false },
    ],
    indexes: [
      { key: 'circleId_idx', type: 'key', attributes: ['circleId'] },
      { key: 'circle_user_idx', type: 'unique', attributes: ['circleId', 'userId'] },
    ],
  },
  {
    // Real-Time Circle Chat (spec §47) + Circle AI (spec §46, kind='ai_facilitator').
    id: 'circle_messages',
    name: 'Circle Messages',
    attributes: [
      { key: 'circleId', type: 'string', size: 36, required: true },
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'displayName', type: 'string', size: 64, required: false },
      { key: 'content', type: 'string', size: 500, required: true },
      { key: 'kind', type: 'string', size: 16, required: false, default: 'message' },
    ],
    indexes: [{ key: 'circleId_idx', type: 'key', attributes: ['circleId'] }],
  },
  {
    // Interruption Value Engine (spec §50-51) — real, tracked notification
    // outcomes ('scheduled' = the engine decided real signals justified
    // firing one; 'opened' = the user actually tapped it), so dismissal
    // rate can be computed from genuine history rather than guessed.
    id: 'notification_events',
    name: 'Notification Events',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'category', type: 'string', size: 32, required: true },
      { key: 'kind', type: 'enum', elements: ['scheduled', 'opened'], required: true },
    ],
    indexes: [{ key: 'user_category_idx', type: 'key', attributes: ['userId', 'category'] }],
  },
  {
    // Basic Circle Moderation — block (per-user, client-side filtering of
    // a member's messages) and report (rule-based, no AI: a message is
    // hidden for every member once 2+ distinct users report it). There is
    // no admin panel in this build (out of scope), so reports resolve by
    // threshold rather than a human review queue.
    id: 'circle_moderation',
    name: 'Circle Moderation',
    attributes: [
      { key: 'kind', type: 'enum', elements: ['block', 'report'], required: true },
      { key: 'actorUserId', type: 'string', size: 64, required: true },
      { key: 'targetUserId', type: 'string', size: 64, required: false },
      { key: 'circleId', type: 'string', size: 36, required: true },
      { key: 'messageId', type: 'string', size: 36, required: false },
    ],
    indexes: [
      { key: 'actor_idx', type: 'key', attributes: ['actorUserId'] },
      { key: 'message_idx', type: 'key', attributes: ['messageId'] },
    ],
  },
  {
    // Live Reset Rooms / Reset Together / Focus Together (spec §43-44,
    // §50) — one shared mechanism: a session's remaining time is always
    // derived from `startedAt + durationSeconds`, so every participant's
    // countdown agrees without any server-side ticking.
    id: 'live_sessions',
    name: 'Live Sessions',
    attributes: [
      { key: 'kind', type: 'enum', elements: ['reset', 'focus'], required: true },
      { key: 'label', type: 'string', size: 64, required: true },
      { key: 'startedAt', type: 'datetime', required: true },
      { key: 'durationSeconds', type: 'integer', required: true },
      { key: 'createdBy', type: 'string', size: 64, required: false },
    ],
    indexes: [{ key: 'kind_idx', type: 'key', attributes: ['kind'] }],
  },
  {
    id: 'live_session_participants',
    name: 'Live Session Participants',
    attributes: [
      { key: 'sessionId', type: 'string', size: 36, required: true },
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'displayName', type: 'string', size: 64, required: false },
    ],
    indexes: [
      { key: 'sessionId_idx', type: 'key', attributes: ['sessionId'] },
      { key: 'session_user_idx', type: 'unique', attributes: ['sessionId', 'userId'] },
    ],
  },
];
