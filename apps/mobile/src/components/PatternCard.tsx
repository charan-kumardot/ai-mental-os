import React from 'react';
import { View, Text, ViewStyle, StyleProp } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { GlassCard } from './GlassCard';

/** Spec §105's PatternCard — one already-detected, real correlation. */
export function PatternCard({
  description,
  relationshipType,
  style,
}: {
  description: string;
  relationshipType: 'positive' | 'negative';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <GlassCard compact style={style}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.aiAccent + '1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name={relationshipType === 'positive' ? 'trending-up' : 'trending-down'} size={15} color={colors.aiAccent} />
        </View>
        <Text style={[typography.caption, { color: colors.textPrimary, flex: 1 }]}>{description}</Text>
      </View>
    </GlassCard>
  );
}
