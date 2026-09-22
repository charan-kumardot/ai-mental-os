import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function TextField({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xxs }]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          typography.body,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.critical : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={[typography.caption, { color: colors.critical, marginTop: spacing.xxs }]}>{error}</Text>
      ) : null}
    </View>
  );
}
