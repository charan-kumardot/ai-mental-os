import React from 'react';
import { View, Text, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { GlassCard } from './GlassCard';
import { EvidenceBadge } from './EvidenceBadge';

/** Spec §105's InsightCard — one AI-generated, grounded observation. */
export function InsightCard({
  title,
  body,
  confidence,
  style,
}: {
  title: string;
  body: string;
  confidence?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <GlassCard tint="accent" style={style}>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[typography.insightQuote, { color: colors.textSecondary, marginTop: spacing.sm }]}>"{body}"</Text>
      {typeof confidence === 'number' && (
        <View style={{ marginTop: spacing.md }}>
          <EvidenceBadge confidence={confidence} />
        </View>
      )}
    </GlassCard>
  );
}
