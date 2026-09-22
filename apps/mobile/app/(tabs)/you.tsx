import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/lib/auth-context';
import { useProfile } from '../../src/lib/profile-context';
import { exportUserData, deleteAccountForever, deleteSourceData } from '../../src/lib/privacy';
import { GlassCard } from '../../src/components/GlassCard';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { PressableRow } from '../../src/components/PressableRow';
import { Switch } from '../../src/components/Switch';
import { requestCalendarAccess, getCalendarAccessStatus, syncTodayCalendarSummary, syncTomorrowCalendarSummary } from '../../src/lib/calendar';
import { requestHealthAccess, getHealthAccessStatus, getHealthAvailability, syncTodayHealthData } from '../../src/lib/health';
import { requestNotificationPermission, reconcileDailyReminder, cancelDailyReminder } from '../../src/lib/notifications';
import { fetchReminderLearning, NotificationLearningResult } from '../../src/lib/notificationLearning';
import { isContextModeActive } from '../../src/lib/contextMode';
import {
  getCommunicationStyle,
  setCommunicationStyle,
  CommunicationStyle,
  CommunicationLength,
  CommunicationTone,
} from '../../src/lib/interactionPreference';
import { databases, DB_ID, COLLECTIONS, Permission, Role } from '../../src/lib/appwrite';

type ConnectionState = 'checking' | 'unavailable' | 'not_connected' | 'connecting' | 'connected' | 'error';

const REMINDER_HOUR = 20;
const REMINDER_MINUTE = 0;

function Row({ label, value }: { label: string; value?: string | null }) {
  const { colors, typography, spacing } = useTheme();
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: React.ComponentProps<typeof Feather>['name']; title: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
      <Feather name={icon} size={16} color={colors.textPrimary} />
      <Text style={[typography.headline, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

export default function You() {
  const { colors, spacing, typography } = useTheme();
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [savingPrivacyMode, setSavingPrivacyMode] = useState(false);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [calendarState, setCalendarState] = useState<ConnectionState>('checking');
  const [calendarSummaryText, setCalendarSummaryText] = useState<string | null>(null);
  const [healthState, setHealthState] = useState<ConnectionState>('checking');
  const [healthSummaryText, setHealthSummaryText] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderLearning, setReminderLearning] = useState<NotificationLearningResult | null>(null);
  const [commStyle, setCommStyle] = useState<CommunicationStyle>({ length: 'short', tone: 'gentle' });

  useEffect(() => {
    getCommunicationStyle().then(setCommStyle);
  }, []);

  const handleStyleChange = (patch: Partial<CommunicationStyle>) => {
    const next = { ...commStyle, ...patch };
    setCommStyle(next);
    setCommunicationStyle(next).catch(() => {});
  };

  useEffect(() => {
    (async () => {
      const granted = await getCalendarAccessStatus();
      if (granted && user) {
        setCalendarState('connected');
        try {
          const summary = await syncTodayCalendarSummary(user.$id);
          setCalendarSummaryText(
            summary.meetingCount === 0
              ? 'No meetings today'
              : `${summary.meetingCount} meeting${summary.meetingCount === 1 ? '' : 's'} today · ${summary.meetingDensity} load`
          );
          syncTomorrowCalendarSummary(user.$id).catch(() => {});
        } catch (e) {
          console.error('calendar resync failed', e);
        }
      } else {
        setCalendarState('not_connected');
      }
    })();
    (async () => {
      const availability = await getHealthAvailability();
      if (availability !== 'available') {
        setHealthState('unavailable');
        return;
      }
      const granted = await getHealthAccessStatus();
      if (granted && user) {
        setHealthState('connected');
        try {
          const summary = await syncTodayHealthData(user.$id);
          const parts: string[] = [];
          if (summary.steps != null) parts.push(`${summary.steps} steps`);
          if (summary.sleepMinutes != null) parts.push(`${Math.round(summary.sleepMinutes / 60)}h sleep`);
          setHealthSummaryText(parts.length ? parts.join(' · ') : 'Connected — no data yet today');
        } catch (e) {
          console.error('health resync failed', e);
        }
      } else {
        setHealthState('not_connected');
      }
    })();
    if (user) {
      databases
        .getDocument(DB_ID, COLLECTIONS.notificationsPrefs, user.$id)
        .then((doc: any) => {
          const enabled = (doc.categoriesEnabled ?? []).includes('daily_checkin_reminder');
          setReminderEnabled(enabled);
          // Spec §51 — real learning about whether the reminder is actually
          // landing, from real check-in history, not a guess.
          fetchReminderLearning(enabled).then(setReminderLearning).catch(() => setReminderLearning(null));
        })
        .catch(() => setReminderEnabled(false));
    }
  }, [user]);

  const handleConnectCalendar = async () => {
    if (!user) return;
    setCalendarState('connecting');
    try {
      const granted = await requestCalendarAccess();
      if (!granted) {
        setCalendarState('not_connected');
        return;
      }
      const summary = await syncTodayCalendarSummary(user.$id);
      syncTomorrowCalendarSummary(user.$id).catch(() => {});
      setCalendarState('connected');
      setCalendarSummaryText(
        summary.meetingCount === 0
          ? 'No meetings today'
          : `${summary.meetingCount} meeting${summary.meetingCount === 1 ? '' : 's'} today · ${summary.meetingDensity} load`
      );
    } catch {
      setCalendarState('error');
    }
  };

  const handleConnectHealth = async () => {
    if (!user) return;
    setHealthState('connecting');
    try {
      const granted = await requestHealthAccess();
      if (!granted) {
        setHealthState('not_connected');
        return;
      }
      const summary = await syncTodayHealthData(user.$id);
      setHealthState('connected');
      const parts: string[] = [];
      if (summary.steps != null) parts.push(`${summary.steps} steps`);
      if (summary.sleepMinutes != null) parts.push(`${Math.round(summary.sleepMinutes / 60)}h sleep`);
      setHealthSummaryText(parts.length ? parts.join(' · ') : 'Connected — no data yet today');
    } catch {
      setHealthState('error');
    }
  };

  const handleToggleReminder = async (next: boolean) => {
    if (!user) return;
    setReminderLoading(true);
    try {
      if (next) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          setReminderLoading(false);
          return;
        }
        await reconcileDailyReminder(user.$id, REMINDER_HOUR, REMINDER_MINUTE);
      } else {
        await cancelDailyReminder();
      }
      await databases.upsertDocument(
        DB_ID,
        COLLECTIONS.notificationsPrefs,
        user.$id,
        { userId: user.$id, categoriesEnabled: next ? ['daily_checkin_reminder'] : [] },
        [
          Permission.read(Role.user(user.$id)),
          Permission.update(Role.user(user.$id)),
          Permission.delete(Role.user(user.$id)),
        ]
      );
      setReminderEnabled(next);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } finally {
      setSigningOut(false);
    }
  };

  const handleSetPrivacyMode = async (mode: 'maximum_privacy' | 'balanced' | 'maximum_intelligence') => {
    if (savingPrivacyMode || profile?.privacyMode === mode) return;
    setSavingPrivacyMode(true);
    try {
      await updateProfile({ privacyMode: mode });
    } finally {
      setSavingPrivacyMode(false);
    }
  };

  const confirmDeleteSource = (label: string, collectionId: string) => {
    Alert.alert(
      `Delete ${label}?`,
      `This permanently removes every ${label.toLowerCase()} record. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setDeletingSource(collectionId);
            try {
              const count = await deleteSourceData(collectionId, user.$id);
              Alert.alert('Deleted', `Removed ${count} record${count === 1 ? '' : 's'}.`);
            } catch (e: any) {
              Alert.alert('Could not delete', e?.message ?? 'Something went wrong. Try again.');
            } finally {
              setDeletingSource(null);
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await exportUserData(user.$id);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes every check-in, reflection, insight and setting — everything. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: handleDelete },
      ]
    );
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteAccountForever();
      if (result.error) {
        Alert.alert('Could not delete account', result.error);
        return;
      }
      router.replace('/(auth)/sign-in');
    } catch (e: any) {
      Alert.alert('Could not delete account', e?.message ?? 'Something went wrong. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
        <Text style={[typography.display, { color: colors.textPrimary }]}>You</Text>

        <GlassCard>
          <SectionHeader icon="user" title="Profile" />
          <Row label="Name" value={profile?.name || user?.name} />
          <Row label="Email" value={user?.email} />
          <Row label="Focus" value={profile?.mode?.replace('_', ' ')} />
          <Row label="Goals" value={profile?.goals?.join(', ')} />
          <Row label="Timezone" value={profile?.timezone} />
        </GlassCard>

        <GlassCard>
          <SectionHeader icon="link" title="Connected sources" />
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Optional. Nothing here is required for the app to work — it only sharpens what insights can account for.
          </Text>

          <PressableRow
            onPress={handleConnectCalendar}
            style={{ gap: spacing.sm, marginBottom: spacing.md, opacity: calendarState === 'connecting' ? 0.6 : 1 }}
          >
            <Feather name="calendar" size={18} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Calendar</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {calendarState === 'checking' && 'Checking…'}
                {calendarState === 'connecting' && 'Requesting access…'}
                {calendarState === 'not_connected' && 'Meeting count and density only — never titles or attendees.'}
                {calendarState === 'connected' && (calendarSummaryText ?? 'Connected')}
                {calendarState === 'error' && 'Something went wrong — tap to retry.'}
              </Text>
            </View>
            {calendarState === 'connected' ? (
              <Feather name="check-circle" size={18} color={colors.success} />
            ) : (
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            )}
          </PressableRow>

          <PressableRow
            onPress={healthState === 'unavailable' ? () => {} : handleConnectHealth}
            style={{ gap: spacing.sm, marginBottom: spacing.md, opacity: healthState === 'connecting' ? 0.6 : 1 }}
          >
            <Feather name="activity" size={18} color={colors.aiAccent} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Health Connect</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {healthState === 'checking' && 'Checking…'}
                {healthState === 'connecting' && 'Requesting access…'}
                {healthState === 'not_connected' && 'Steps, sleep and resting heart rate.'}
                {healthState === 'connected' && (healthSummaryText ?? 'Connected')}
                {healthState === 'unavailable' &&
                  'Health Connect app is not installed on this device — install it from the Play Store to enable this.'}
                {healthState === 'error' && 'Something went wrong — tap to retry.'}
              </Text>
            </View>
            {healthState === 'connected' ? (
              <Feather name="check-circle" size={18} color={colors.success} />
            ) : healthState === 'unavailable' ? null : (
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            )}
          </PressableRow>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name="bell" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Daily reminder</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                A gentle nudge at 8pm, nothing more — never more than once a day.
              </Text>
            </View>
            <Switch value={reminderEnabled} onValueChange={handleToggleReminder} disabled={reminderLoading} />
          </View>
          {reminderLearning?.skipped === false && reminderLearning.learning && (
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.xs,
                marginTop: spacing.sm,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Feather
                name={reminderLearning.learning.recommendation === 'reduce' ? 'alert-circle' : 'check-circle'}
                size={14}
                color={reminderLearning.learning.recommendation === 'reduce' ? colors.warning : colors.success}
              />
              <Text style={[typography.micro, { color: colors.textSecondary, flex: 1 }]}>{reminderLearning.learning.message}</Text>
            </View>
          )}
        </GlassCard>

        <GlassCard>
          <SectionHeader icon="life-buoy" title="Support" />
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Bridges to real people, when you want them — nothing here is sent automatically.
          </Text>
          <PressableRow onPress={() => router.push('/context-mode')} style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <Feather name="compass" size={18} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>What's going on right now?</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {isContextModeActive(profile) ? `${profile?.activeContextLabel} is active` : 'Set a temporary life context'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableRow>
          <PressableRow onPress={() => router.push('/talk-to-someone')} style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <Feather name="message-circle" size={18} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Talk to someone</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Draft a message to someone you trust</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableRow>
          <PressableRow onPress={() => router.push('/professional-handoff')} style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <Feather name="clipboard" size={18} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Prepare for a conversation</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>A real summary to bring to a professional</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableRow>
          <PressableRow onPress={() => router.push('/rehearse')} style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <Feather name="mic" size={18} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Rehearse a conversation</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Practice before the real thing</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableRow>
          <PressableRow onPress={() => router.push('/boundary-coach')} style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <Feather name="shield" size={18} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Set a boundary</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Structure it, then draft the message</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableRow>
          <PressableRow onPress={() => router.push('/wellbeing-passport')} style={{ gap: spacing.sm }}>
            <Feather name="book" size={18} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>My wellbeing manual</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>A real, structured summary — choose what to share</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableRow>
        </GlassCard>

        <GlassCard>
          <SectionHeader icon="message-square" title="How I talk to you" />
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Applies to real AI-written notes like "What happened today."
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
            {(['short', 'detailed'] as CommunicationLength[]).map((l) => (
              <SecondaryButton
                key={l}
                label={l === 'short' ? 'Short' : 'Detailed'}
                onPress={() => handleStyleChange({ length: l })}
                style={commStyle.length === l ? { opacity: 1 } : { opacity: 0.5 }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {(['gentle', 'direct'] as CommunicationTone[]).map((t) => (
              <SecondaryButton
                key={t}
                label={t === 'gentle' ? 'Gentle' : 'Direct'}
                onPress={() => handleStyleChange({ tone: t })}
                style={commStyle.tone === t ? { opacity: 1 } : { opacity: 0.5 }}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard>
          <SectionHeader icon="shield" title="Privacy" />
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Your mind. Your data. Your control. No advertising based on mental state, nothing sold, no employer
            access.
          </Text>

          <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Privacy mode
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            {profile?.privacyMode === 'maximum_privacy'
              ? 'Maximum privacy: the Relationship map, Operating Manual and Today state are all switched off — nothing synthesizes across your connected sources.'
              : 'Balanced (default): full personalization, same grounding and evidence rules everywhere else in the app.'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
            {(
              [
                { value: 'maximum_privacy' as const, label: 'Maximum privacy' },
                { value: 'balanced' as const, label: 'Balanced' },
                { value: 'maximum_intelligence' as const, label: 'Maximum intelligence' },
              ]
            ).map((opt) => {
              const active = (profile?.privacyMode ?? 'balanced') === opt.value;
              return (
                <PressableRow key={opt.value} onPress={() => handleSetPrivacyMode(opt.value)}>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: active ? colors.surface : colors.textPrimary,
                        backgroundColor: active ? colors.primary : colors.primarySoft,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 6,
                        borderRadius: 14,
                        overflow: 'hidden',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </PressableRow>
              );
            })}
          </View>

          <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Delete just one source
          </Text>
          <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
            {(
              [
                { label: 'Health data', collectionId: COLLECTIONS.healthData },
                { label: 'Calendar data', collectionId: COLLECTIONS.calendarSummaries },
                { label: 'Voice reflections', collectionId: COLLECTIONS.voiceReflections },
              ]
            ).map((src) => (
              <PressableRow
                key={src.collectionId}
                onPress={() => confirmDeleteSource(src.label, src.collectionId)}
                style={{ gap: spacing.sm, opacity: deletingSource === src.collectionId ? 0.5 : 1 }}
              >
                <Feather name="trash-2" size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{src.label}</Text>
              </PressableRow>
            ))}
          </View>

          <SecondaryButton
            label="Export my data"
            onPress={handleExport}
            loading={exporting}
            style={{ marginBottom: spacing.sm }}
          />
          <SecondaryButton label="Delete my account" onPress={confirmDelete} loading={deleting} />
        </GlassCard>

        <SecondaryButton label="Sign out" onPress={handleSignOut} loading={signingOut} />
      </ScrollView>
    </ScreenBackground>
  );
}
