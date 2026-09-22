import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useProfile } from '../src/lib/profile-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { CONTEXT_MODE_OPTIONS, isContextModeActive, daysRemaining } from '../src/lib/contextMode';
import { staggerEntering } from '../src/lib/entrance';

/** Spec §17-18 — Life Event Mode + Contextual Modes. Always user-set,
 * always self-expiring, never pathologizing a normal transition. */
export default function ContextMode() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const { profile, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);

  const active = isContextModeActive(profile);
  const activeOption = CONTEXT_MODE_OPTIONS.find((o) => o.key === profile?.activeContextMode);

  const handleSet = async (key: string, label: string, durationDays: number) => {
    setSaving(true);
    try {
      const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();
      await updateProfile({ activeContextMode: key, activeContextLabel: label, activeContextExpiresAt: expiresAt });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await updateProfile({ activeContextMode: undefined, activeContextLabel: undefined, activeContextExpiresAt: undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="What's going on right now?" />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Going through something? Say so, and I'll keep it in mind for a while — this never labels a normal
          transition as a problem, and it always expires on its own.
        </Text>

        {active && activeOption && (
          <GlassCard tint="accent">
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{activeOption.label} is active</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
              {daysRemaining(profile?.activeContextExpiresAt)} day(s) remaining
            </Text>
            <SecondaryButton label="Clear now" onPress={handleClear} loading={saving} style={{ marginTop: spacing.md }} />
          </GlassCard>
        )}

        <GlassCard>
          <Text style={[typography.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }]}>
            Life events
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
            {CONTEXT_MODE_OPTIONS.filter((o) => o.group === 'life_event').map((o, i) => (
              <Animated.View key={o.key} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                <SecondaryButton label={o.label} onPress={() => handleSet(o.key, o.label, o.durationDays)} loading={saving} />
              </Animated.View>
            ))}
          </View>
          <Text style={[typography.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }]}>
            Right now
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {CONTEXT_MODE_OPTIONS.filter((o) => o.group === 'contextual').map((o, i) => (
              <Animated.View key={o.key} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                <SecondaryButton label={o.label} onPress={() => handleSet(o.key, o.label, o.durationDays)} loading={saving} />
              </Animated.View>
            ))}
          </View>
        </GlassCard>

        <SecondaryButton label="Not now" onPress={() => router.back()} />
      </ScrollView>
    </ScreenBackground>
  );
}
