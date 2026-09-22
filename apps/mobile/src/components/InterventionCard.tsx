import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { GlassCard } from './GlassCard';
import { PressableRow } from './PressableRow';

/** Spec §105's InterventionCard — one triable technique. Icon-circle +
 * chevron-circle row, matching the "for you" row-card language established
 * on Home rather than a bare icon + plain arrow. */
export function InterventionCard({
  icon,
  title,
  description,
  meta,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  meta: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <GlassCard compact>
      <PressableRow onPress={onPress} style={{ gap: spacing.sm }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.secondary + '1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name={icon} size={18} color={colors.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{description}</Text>
          <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.xs }]}>{meta}</Text>
        </View>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="chevron-right" size={16} color={colors.background} />
        </View>
      </PressableRow>
    </GlassCard>
  );
}
