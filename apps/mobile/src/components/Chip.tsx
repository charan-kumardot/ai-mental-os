import React from 'react';
import { Pressable, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={{
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        marginRight: spacing.xs,
        marginBottom: spacing.xs,
      }}
    >
      <Text style={[typography.caption, { color: selected ? colors.primary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}
