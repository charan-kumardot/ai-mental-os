import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/lib/auth-context';
import { useProfile } from '../../src/lib/profile-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { AIOrb } from '../../src/components/AIOrb';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { LivePulseDot } from '../../src/components/LivePulseDot';
import { CountdownRing } from '../../src/components/CountdownRing';
import {
  SESSION_CATALOG,
  joinOrStartSession,
  countSessionParticipants,
  subscribeToSessionParticipants,
  secondsRemaining,
  LiveSession,
} from '../../src/lib/liveSessions';

function formatTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Live Reset Rooms / Focus Together (spec §43, §50) — "No leaderboard, no
 * chat, just presence": the only real-time signal here is how many other
 * real people are in the same room right now, and a countdown every
 * participant derives from the same shared start time.
 */
export default function LiveSessionScreen() {
  const { colors, spacing, typography, reduceMotion } = useTheme();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [count, setCount] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const finalCountRef = useRef(0);

  const entry = SESSION_CATALOG.find((e) => e.key === key);
  const displayName = profile?.name || user?.name || 'Someone';

  useEffect(() => {
    if (!user || !entry) return;
    joinOrStartSession(entry, user.$id, displayName).then(setSession);
  }, [user, entry?.key]);

  useEffect(() => {
    if (!session) return;
    countSessionParticipants(session.$id).then(setCount);
    const unsub = subscribeToSessionParticipants(session.$id, () => {
      countSessionParticipants(session.$id).then(setCount);
    });
    return () => unsub();
  }, [session?.$id]);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const r = secondsRemaining(session);
      setRemaining(r);
      if (r <= 0) {
        finalCountRef.current = count;
        setFinished((prev) => {
          if (!prev) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return true;
        });
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session, count]);

  if (!entry) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>That session doesn't exist.</Text>
          <PrimaryButton label="Back" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        {finished ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(400)} style={{ alignItems: 'center' }}>
            <AIOrb state="success" size={72} />
            <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
              {finalCountRef.current > 1
                ? `${finalCountRef.current} people just completed this together.`
                : 'Done.'}
            </Text>
            <PrimaryButton label="Back to community" onPress={() => router.replace('/community')} style={{ marginTop: spacing.xl, width: 220 }} />
          </Animated.View>
        ) : (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(400)} style={{ alignItems: 'center' }}>
            <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xs }]}>{entry.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xl }}>
              <LivePulseDot color={colors.aiAccent} />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {count} {count === 1 ? 'person is' : 'people are'} here
              </Text>
            </View>
            <CountdownRing progress={session ? Math.max(0, Math.min(1, (remaining ?? session.durationSeconds) / session.durationSeconds)) : 1} size={148}>
              <AIOrb state="listening" size={100} />
            </CountdownRing>
            <Text style={[typography.hero, { color: colors.textPrimary, fontSize: 40, marginTop: spacing.xl }]}>
              {remaining != null ? formatTime(remaining) : '--:--'}
            </Text>
            <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.lg }]}>
              No chat. No leaderboard. Just presence.
            </Text>
          </Animated.View>
        )}
      </View>
    </ScreenBackground>
  );
}
