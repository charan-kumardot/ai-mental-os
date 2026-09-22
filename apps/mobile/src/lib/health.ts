import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { databases, DB_ID, COLLECTIONS, Permission, Role } from './appwrite';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export type HealthAvailability = 'unavailable' | 'update_required' | 'available' | 'unsupported_platform';

// Health Connect is Android-only. On Android 13 and below it must be
// installed separately from Play Store (it ships as a system app from
// Android 14+); this is surfaced honestly rather than assumed.
export async function getHealthAvailability(): Promise<HealthAvailability> {
  if (Platform.OS !== 'android') return 'unsupported_platform';
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
  return 'unavailable';
}

const PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
  { accessType: 'read' as const, recordType: 'RestingHeartRate' as const },
];

export async function requestHealthAccess(): Promise<boolean> {
  const ok = await initialize();
  if (!ok) return false;
  const granted = await requestPermission(PERMISSIONS);
  return granted.length > 0;
}

export async function getHealthAccessStatus(): Promise<boolean> {
  const ok = await initialize();
  if (!ok) return false;
  const granted = await getGrantedPermissions();
  return granted.some((p) => PERMISSIONS.some((want) => want.recordType === p.recordType));
}

export interface HealthDaySummary {
  steps: number | null;
  sleepMinutes: number | null;
  restingHeartRate: number | null;
}

export async function computeTodaySummary(): Promise<HealthDaySummary> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  // Sleep is queried over a wider window since last night's session usually
  // started before midnight.
  const sleepStart = new Date(start.getTime() - 12 * 60 * 60 * 1000);

  // Each record type is read independently — the user may have granted only
  // some of the three permissions (Health Connect allows picking per-type),
  // and one missing grant shouldn't block the ones that were actually given.
  const emptyResult = { records: [] as any[] };
  const [stepsRes, sleepRes, hrRes] = await Promise.all([
    readRecords('Steps', { timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } }).catch(
      () => emptyResult
    ),
    readRecords('SleepSession', {
      timeRangeFilter: { operator: 'between', startTime: sleepStart.toISOString(), endTime: end.toISOString() },
    }).catch(() => emptyResult),
    readRecords('RestingHeartRate', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    }).catch(() => emptyResult),
  ]);

  const steps = stepsRes.records.reduce((sum, r) => sum + (r.count ?? 0), 0);

  let sleepMinutes = 0;
  for (const r of sleepRes.records) {
    const s = new Date(r.startTime).getTime();
    const e = new Date(r.endTime).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      sleepMinutes += Math.round((e - s) / 60000);
    }
  }

  const hrValues = hrRes.records.map((r) => r.beatsPerMinute).filter((v): v is number => typeof v === 'number');
  const restingHeartRate = hrValues.length
    ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
    : null;

  return {
    steps: stepsRes.records.length ? steps : null,
    sleepMinutes: sleepRes.records.length ? sleepMinutes : null,
    restingHeartRate,
  };
}

export async function syncTodayHealthData(userId: string): Promise<HealthDaySummary> {
  const summary = await computeTodaySummary();
  const docId = `${userId}_${todayKey()}`;
  await databases.upsertDocument(
    DB_ID,
    COLLECTIONS.healthData,
    docId,
    {
      userId,
      date: todayKey(),
      steps: summary.steps ?? undefined,
      sleepMinutes: summary.sleepMinutes ?? undefined,
      restingHeartRate: summary.restingHeartRate ?? undefined,
      source: 'health_connect',
    },
    [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
  return summary;
}
