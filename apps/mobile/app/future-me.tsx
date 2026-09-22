import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { fetchFutureMe, FutureMePreset, FutureMeResult } from '../src/lib/futureMe';
import { staggerEntering } from '../src/lib/entrance';

const PRESETS: { key: FutureMePreset; label: string }[] = [
  { key: 'short_sleep', label: 'a short-sleep night' },
  { key: 'heavy_meetings', label: 'a heavy-meeting day' },
  { key: 'low_movement', label: 'a low-movement day' },
];

/** Spec §22 — Future Me. Always a labeled historical pattern, never a
 * deterministic prediction. */
export default function FutureMe() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const [loading, setLoading] = useState<FutureMePreset | null>(null);
  const [results, setResults] = useState<Record<string, FutureMeResult>>({});

  const handlePick = async (preset: FutureMePreset) => {
    setLoading(preset);
    try {
      const result = await fetchFutureMe(preset);
      setResults((prev) => ({ ...prev, [preset]: result }));
      if (!result.skipped) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setLoading(null);
    }
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="What usually happens?" orbState={loading ? 'thinking' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Real patterns from your own history — never a guarantee of what happens next time.
        </Text>

        {PRESETS.map((p, i) => {
          const result = results[p.key];
          return (
            <Animated.View key={p.key} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
              <GlassCard tint={result && !result.skipped ? 'accent' : undefined}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                  What usually happens after {p.label}?
                </Text>
                {result ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {result.skipped ? result.message : result.text}
                  </Text>
                ) : (
                  <SecondaryButton label="Check my history" onPress={() => handlePick(p.key)} loading={loading === p.key} accessibilityLabel={`Check my history for what usually happens after ${p.label}`} />
                )}
              </GlassCard>
            </Animated.View>
          );
        })}
      </ScrollView>
    </ScreenBackground>
  );
}
