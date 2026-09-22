import React from 'react';
import { View, Text, ViewStyle, StyleProp } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';

export type StatTone = 'good' | 'warning' | 'critical' | 'neutral';

const TONE_COLOR: Record<StatTone, (colors: any) => string> = {
  good: (c) => c.success,
  warning: (c) => c.warning,
  critical: (c) => c.critical,
  neutral: (c) => c.textMuted,
};

/**
 * Compact metric surface: pill label → big number → small unit → one
 * color-coded status word. Modeled on real reference patterns (Tempo AI
 * Health Assistant, Behance) rather than an icon+caption row — a single
 * number reads faster than a sentence, and the status word carries the
 * judgment so the number doesn't have to be independently interpreted.
 */
export function StatTile({
  label,
  value,
  unit,
  status,
  tone = 'neutral',
  style,
}: {
  label: string;
  value: string | number;
  unit?: string;
  status?: string;
  tone?: StatTone;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const statusColor = TONE_COLOR[tone](colors);
  // A soft glow on tiles carrying a real judgment (good/warning/critical) —
  // ties back to the same halo language the AIOrb uses for its own active
  // states, so "this tile has something real to say" reads consistently
  // across the app rather than the glow being orb-exclusive.
  const hasRealSignal = tone !== 'neutral';

  return (
    <GlassCard
      compact
      style={[
        { alignItems: 'center' },
        hasRealSignal && {
          shadowColor: statusColor,
          shadowOpacity: 0.5,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: colors.primarySoft,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: radius.pill,
          marginBottom: spacing.xs,
        }}
      >
        <Text style={[typography.micro, { color: colors.textSecondary, fontWeight: '700' }]}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        <AnimatedNumber value={value} style={{ fontSize: 30, lineHeight: 34, fontWeight: '700', color: colors.textPrimary }} />
        {unit ? <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 3 }]}>{unit}</Text> : null}
      </View>
      {status ? (
        <Animated.Text
          key={status}
          entering={FadeIn.duration(300)}
          style={[typography.micro, { color: statusColor, fontWeight: '700', marginTop: 2 }]}
        >
          {status}
        </Animated.Text>
      ) : null}
    </GlassCard>
  );
}
