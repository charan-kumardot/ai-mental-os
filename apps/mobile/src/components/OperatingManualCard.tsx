import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { GlassCard } from './GlassCard';

/**
 * Spec §105's OperatingManualCard — one named, evidence-backed section of
 * the Personal Operating Manual (spec §79: "I focus best", "What's
 * worked", not one blended paragraph). Purely presentational; the caller
 * decides which sections have enough real evidence to render at all.
 */
export function OperatingManualCard({
  icon,
  label,
  text,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  text: string;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <GlassCard compact>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xxs }}>
        <Feather name={icon} size={14} color={colors.aiAccent} />
        <Text style={[typography.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          {label}
        </Text>
      </View>
      <Text style={[typography.insightQuote, { color: colors.textPrimary }]}>{text}</Text>
    </GlassCard>
  );
}
