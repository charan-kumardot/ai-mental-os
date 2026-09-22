import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../src/lib/auth-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { PressableRow } from '../src/components/PressableRow';
import { Timeline, TimelineItem } from '../src/components/Timeline';
import { staggerEntering } from '../src/lib/entrance';
import { fetchWhatHappened, WhatHappenedResult } from '../src/lib/whatHappened';
import {
  listInterventionResults,
  listCustomInterventions,
  computeAutopilotRanking,
  findIntervention,
  startIntervention,
} from '../src/lib/interventions';

function iconFor(label: string): keyof typeof Feather.glyphMap {
  if (label.startsWith('Checked in')) return 'smile';
  if (label.startsWith('Tried')) return 'zap';
  if (label.startsWith('Noted a decision')) return 'git-branch';
  if (label.startsWith('Noted a conversation')) return 'message-circle';
  if (label.startsWith('Wrote down something you felt')) return 'heart';
  return 'edit-3';
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function WhatHappened() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<WhatHappenedResult | null>(null);
  const [topIntervention, setTopIntervention] = useState<{ id: string; title: string; helped: number; attempts: number } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [whatHappened, results, customInterventions] = await Promise.all([
        fetchWhatHappened(),
        listInterventionResults(user.$id),
        listCustomInterventions(user.$id),
      ]);
      setResult(whatHappened);
      const autopilot = computeAutopilotRanking(results);
      if (autopilot.ready) {
        const best = autopilot.ranked[0];
        const def = findIntervention(best.interventionId, customInterventions);
        if (def) setTopIntervention({ id: def.id, title: def.title, helped: best.helped, attempts: best.attempts });
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const items: TimelineItem[] =
    result?.events?.map((e, i) => ({
      id: String(i),
      icon: iconFor(e.label),
      content: e.label,
      dateLabel: timeLabel(e.time),
    })) ?? [];

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="What happened today" orbState={loading ? 'thinking' : result?.collided ? 'insight' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          A real reconstruction of today, built only from what you actually logged — nothing invented.
        </Text>

        {!loading && result?.skipped && (
          <GlassCard>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>{result.message}</Text>
          </GlassCard>
        )}

        {!loading && !result?.skipped && (
          <>
            {(result?.deltas?.length ?? 0) > 0 && (
              <GlassCard tint="accent">
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  Compared to your normal
                </Text>
                {result!.deltas!.map((d, i) => (
                  <Animated.View key={i} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: i === 0 ? 0 : 4 }]}>{d}</Text>
                  </Animated.View>
                ))}
              </GlassCard>
            )}

            <GlassCard>
              <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.md }]}>Today, so far</Text>
              <Timeline items={items} />
            </GlassCard>

            {result?.closing && (
              <GlassCard tint="accent">
                <Text style={[typography.insightQuote, { color: colors.textPrimary }]}>{result.closing}</Text>
                <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.sm }]}>
                  I can't know exactly why you feel a certain way — this is only what was genuinely different today.
                </Text>
              </GlassCard>
            )}

            <GlassCard>
              <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xs }]}>Your move</Text>
              {topIntervention ? (
                <PressableRow
                  onPress={() => {
                    if (!user) return;
                    Haptics.selectionAsync().catch(() => {});
                    startIntervention(user.$id, topIntervention.id, 'what_happened_today').then(() => router.push('/interventions'));
                  }}
                  style={{ gap: spacing.sm }}
                  accessibilityLabel={`Try ${topIntervention.title}`}
                >
                  <Feather name="zap" size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{topIntervention.title}</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      Helped you {topIntervention.helped}/{topIntervention.attempts} times before
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </PressableRow>
              ) : (
                <PressableRow
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    router.push('/interventions');
                  }}
                  style={{ gap: spacing.sm }}
                  accessibilityLabel="Try something small"
                >
                  <Feather name="zap" size={18} color={colors.success} />
                  <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
                    Still learning what helps you — try something small.
                  </Text>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </PressableRow>
              )}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
