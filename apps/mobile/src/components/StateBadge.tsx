import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Small icon+label read of where a real dimension sits (spec §105's
 * StateBadge). Purely presentational — callers own the level→color mapping
 * since "high" means something different per dimension (e.g. high mental
 * load is worse, high recovery is better), so this never guesses polarity
 * on its own.
 */
export function StateBadge({
  icon,
  label,
  color,
  size = 'default',
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  size?: 'default' | 'compact';
}) {
  const { typography } = useTheme();
  const textStyle = size === 'compact' ? typography.micro : typography.caption;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Feather name={icon} size={size === 'compact' ? 11 : 13} color={color} />
      <Text style={[textStyle, { color, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}
