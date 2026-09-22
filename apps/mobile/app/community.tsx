import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/lib/auth-context';
import { useProfile } from '../src/lib/profile-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { PressableRow } from '../src/components/PressableRow';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { TextField } from '../src/components/TextField';
import { LivePulseDot } from '../src/components/LivePulseDot';
import { staggerEntering } from '../src/lib/entrance';
import {
  PresenceStatus,
  PRESENCE_LABEL,
  setMyPresence,
  getMyPresence,
  clearMyPresence,
  listActivePresence,
  subscribeToPresence,
  PresenceDoc,
} from '../src/lib/presence';
import { SESSION_CATALOG } from '../src/lib/liveSessions';
import { Circle, listCircles, createCircle } from '../src/lib/circles';

const STATUS_ORDER: PresenceStatus[] = ['available', 'focusing', 'walking', 'winding_down', 'resetting', 'open_to_talk', 'break', 'dnd'];

/**
 * Realtime/social hub (spec §41-47) — Live Wellbeing Presence, Live
 * Sessions (Reset/Focus Together), and Circles combined into one screen
 * rather than three separate entry points, since this is a new, small
 * layer of the app and doesn't yet warrant its own tab.
 */
export default function Community() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [myStatus, setMyStatus] = useState<PresenceStatus | null>(null);
  const [others, setOthers] = useState<PresenceDoc[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [showCreateCircle, setShowCreateCircle] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [creatingCircle, setCreatingCircle] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const displayName = profile?.name || user?.name || 'Someone';

  const loadOthers = useCallback(() => {
    if (!user) return;
    listActivePresence(user.$id).then(setOthers).catch(() => setOthers([]));
  }, [user]);

  useEffect(() => {
    loadOthers();
    const unsub = subscribeToPresence(loadOthers);
    return () => unsub();
  }, [loadOthers]);

  useEffect(() => {
    listCircles().then(setCircles).catch(() => setCircles([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    getMyPresence(user.$id).then(setMyStatus).catch(() => {});
  }, [user]);

  const handleSetStatus = async (status: PresenceStatus) => {
    if (!user) return;
    Haptics.selectionAsync().catch(() => {});
    setMyStatus(status);
    await setMyPresence(user.$id, displayName, status).catch(() => {});
  };

  const handleClearStatus = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMyStatus(null);
    await clearMyPresence(user.$id).catch(() => {});
  };

  const handleCreateCircle = async () => {
    if (!user || !newCircleName.trim()) return;
    setCreatingCircle(true);
    try {
      await createCircle(user.$id, newCircleName.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNewCircleName('');
      setShowCreateCircle(false);
      const fresh = await listCircles();
      setCircles(fresh);
    } finally {
      setCreatingCircle(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Community" />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Optional, always visible only if you choose to show it — never your emotional state, just a status you pick.
        </Text>

        <GlassCard>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            {myStatus ? `You: ${PRESENCE_LABEL[myStatus]}` : 'Show a status?'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: myStatus ? spacing.sm : 0 }}>
            {STATUS_ORDER.map((s) => (
              <SecondaryButton key={s} label={PRESENCE_LABEL[s]} onPress={() => handleSetStatus(s)} />
            ))}
          </View>
          {myStatus && <SecondaryButton label="Go invisible" onPress={handleClearStatus} />}
        </GlassCard>

        {others.length > 0 && (
          <GlassCard>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Who's around</Text>
            {others.map((o, i) => (
              <Animated.View key={o.$id} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <LivePulseDot />
                    <Text style={[typography.caption, { color: colors.textPrimary }]}>{o.displayName || 'Someone'}</Text>
                  </View>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{PRESENCE_LABEL[o.status]}</Text>
                </View>
              </Animated.View>
            ))}
          </GlassCard>
        )}

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, paddingHorizontal: 2 }}>
            <LivePulseDot color={colors.aiAccent} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Live sessions</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
            {SESSION_CATALOG.map((entry, i) => (
              <Animated.View key={entry.key} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                <GlassCard tint="accent" compact style={{ width: 132 }}>
                  <PressableRow
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      router.push(`/live-session/${entry.key}`);
                    }}
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: spacing.sm, minHeight: 84 }}
                  >
                    <Feather name={entry.kind === 'reset' ? 'wind' : 'target'} size={20} color={colors.aiAccent} />
                    <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={2}>
                      {entry.label}
                    </Text>
                  </PressableRow>
                </GlassCard>
              </Animated.View>
            ))}
          </ScrollView>
        </View>

        <GlassCard>
          <PressableRow
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setShowCreateCircle((s) => {
                const next = !s;
                if (next) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                return next;
              });
            }}
            style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}
          >
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Circles</Text>
            <Feather name="plus-circle" size={20} color={colors.primary} />
          </PressableRow>

          {showCreateCircle && (
            <View style={{ marginBottom: spacing.sm }}>
              <TextField
                placeholder="Circle name…"
                value={newCircleName}
                onChangeText={setNewCircleName}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200)}
              />
              <SecondaryButton label="Create" onPress={handleCreateCircle} loading={creatingCircle} style={{ marginTop: spacing.xs }} />
            </View>
          )}

          {circles.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>No circles yet — start one.</Text>
          ) : (
            circles.map((c, i) => (
              <Animated.View key={c.$id} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
              <PressableRow
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push(`/circle/${c.$id}`);
                }}
                style={{ gap: spacing.sm }}
              >
                <Feather name="users" size={18} color={colors.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.textPrimary }]}>{c.name}</Text>
                  {c.description ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{c.description}</Text> : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </PressableRow>
              </Animated.View>
            ))
          )}
        </GlassCard>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
