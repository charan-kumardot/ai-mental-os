import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { GlassCard } from './GlassCard';
import { EvidenceBadge } from './EvidenceBadge';

export type DiscoveryKind = 'discovery' | 'contradicted' | 'confirmed_hypothesis' | 'unconfirmed_hypothesis' | 'blind_spot';

const KIND_META: Record<DiscoveryKind, { icon: keyof typeof Feather.glyphMap; label: string; tint: 'accent' | 'primary' | undefined }> = {
  discovery: { icon: 'star', label: 'You discovered something', tint: 'accent' },
  contradicted: { icon: 'refresh-cw', label: 'Worth a second look', tint: undefined },
  confirmed_hypothesis: { icon: 'check-circle', label: 'Your hypothesis gained evidence', tint: 'primary' },
  unconfirmed_hypothesis: { icon: 'help-circle', label: "Your recent history doesn't strongly support this", tint: undefined },
  blind_spot: { icon: 'eye', label: 'A pattern you may not have noticed', tint: undefined },
};

/**
 * Spec §105's DiscoveryCard — the shared surface for spec §24-26 (Personal
 * Discoveries, "You were right," "You may have been wrong"). Same card
 * shape for all four kinds so a contradicted belief reads as routine
 * recalibration, not a callout — never shaming, per §26's explicit rule.
 */
export function DiscoveryCard({
  kind,
  title,
  body,
  confidence,
  evidenceCount,
}: {
  kind: DiscoveryKind;
  title: string;
  body: string;
  confidence?: number;
  evidenceCount?: number;
}) {
  const { colors, spacing, typography } = useTheme();
  const meta = KIND_META[kind];

  return (
    <GlassCard tint={meta.tint}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
        <Feather name={meta.icon} size={15} color={colors.aiAccent} />
        <Text style={[typography.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          {meta.label}
        </Text>
      </View>
      <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xs }]}>{title}</Text>
      <Text style={[typography.insightQuote, { color: colors.textSecondary }]}>{body}</Text>
      {typeof confidence === 'number' && (
        <View style={{ marginTop: spacing.sm }}>
          <EvidenceBadge confidence={confidence} evidenceCount={evidenceCount} />
        </View>
      )}
    </GlassCard>
  );
}
