import * as Calendar from 'expo-calendar';
import { databases, DB_ID, COLLECTIONS, Permission, Role } from './appwrite';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function requestCalendarAccess(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissions();
  return status === 'granted';
}

export async function getCalendarAccessStatus(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissions();
  return status === 'granted';
}

export interface CalendarDaySummary {
  meetingCount: number;
  meetingMinutes: number;
  meetingDensity: 'light' | 'moderate' | 'heavy';
  freeWindowMinutes: number;
}

// A rough proxy for "how packed is today" — count and total minutes only,
// never event titles/attendees/locations, matching the privacy promise in
// app.json's calendar permission copy.
const WORKDAY_MINUTES = 8 * 60;

function densityFor(meetingMinutes: number): CalendarDaySummary['meetingDensity'] {
  const ratio = meetingMinutes / WORKDAY_MINUTES;
  if (ratio >= 0.6) return 'heavy';
  if (ratio >= 0.3) return 'moderate';
  return 'light';
}

async function computeDaySummary(dayOffset: number): Promise<CalendarDaySummary> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const ids = calendars.map((c) => c.id);
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const events = ids.length ? await Calendar.listEvents(ids, start, end) : [];
  const meetings = events.filter((e) => !e.allDay);

  let meetingMinutes = 0;
  for (const e of meetings) {
    const s = new Date(e.startDate as string).getTime();
    const en = new Date(e.endDate as string).getTime();
    if (Number.isFinite(s) && Number.isFinite(en) && en > s) {
      meetingMinutes += Math.round((en - s) / 60000);
    }
  }

  return {
    meetingCount: meetings.length,
    meetingMinutes,
    meetingDensity: densityFor(meetingMinutes),
    freeWindowMinutes: Math.max(WORKDAY_MINUTES - meetingMinutes, 0),
  };
}

export async function computeTodaySummary(): Promise<CalendarDaySummary> {
  return computeDaySummary(0);
}

function dateKeyForOffset(dayOffset: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

async function syncDaySummary(userId: string, dayOffset: number): Promise<CalendarDaySummary> {
  const summary = await computeDaySummary(dayOffset);
  const dateKey = dateKeyForOffset(dayOffset);
  const docId = `${userId}_${dateKey}`;
  await databases.upsertDocument(
    DB_ID,
    COLLECTIONS.calendarSummaries,
    docId,
    { userId, date: dateKey, ...summary },
    [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
  return summary;
}

export async function syncTodayCalendarSummary(userId: string): Promise<CalendarDaySummary> {
  return syncDaySummary(userId, 0);
}

// Spec §32, "Pre-Moment Intelligence" — needs tomorrow's real calendar data
// already synced before the backend can compare it against the user's own
// baseline. Best-effort: called alongside the today sync wherever calendar
// access is already granted, never blocking on its own.
export async function syncTomorrowCalendarSummary(userId: string): Promise<CalendarDaySummary> {
  return syncDaySummary(userId, 1);
}
