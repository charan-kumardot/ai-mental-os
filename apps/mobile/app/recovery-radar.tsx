import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { StatTile } from '../src/components/StatTile';
import { fetchRecoveryRadar, RecoveryRadarResult } from '../src/lib/recoveryRadar';
import { staggerEntering } from '../src/lib/entrance';

function formatHours(minutes: number | null) {
  if (minutes == null) return '—';
  return `${(minutes / 60).toFixed(1)}h`;
}

/** Spec §30 — a weekly recovery-focused story, not a spreadsheet: the
 * narrative leads, real numbers follow as light supporting detail. */
export default function RecoveryRadar() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RecoveryRadarResult | null>(null);

  useEffect(() => {
    fetchRecoveryRadar().then(setResult).finally(() => setLoading(false));
  }, []);

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Recovery radar" orbState={loading ? 'thinking' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          How this week has actually gone for load and recovery — not another productivity score.
        </Text>

        {!loading && result?.skipped && (
          <GlassCard>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>{result.message}</Text>
          </GlassCard>
        )}

        {!loading && !result?.skipped && (
          <>
            {result?.narrative && (
              <GlassCard tint="accent">
                <Text style={[typography.insightQuote, { color: colors.textPrimary }]}>{result.narrative}</Text>
              </GlassCard>
            )}

            {(result?.deltas?.length ?? 0) > 0 && (
              <GlassCard>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  What's different this week
                </Text>
                {result!.deltas!.map((d, i) => (
                  <Animated.View key={i} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: i === 0 ? 0 : 4 }]} accessibilityLabel={d}>
                      {d}
                    </Text>
                  </Animated.View>
                ))}
              </GlassCard>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label="AVG SLEEP" value={formatHours(result?.thisWeekAvg?.sleepMinutes ?? null)} tone="neutral" />
              <StatTile
                label="AVG STEPS"
                value={result?.thisWeekAvg?.steps != null ? Math.round(result.thisWeekAvg.steps) : '—'}
                tone="neutral"
              />
              <StatTile
                label="AVG MEETINGS"
                value={result?.thisWeekAvg?.meetingCount != null ? result.thisWeekAvg.meetingCount.toFixed(1) : '—'}
                tone="neutral"
              />
            </View>
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
