import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function PrimaryButton({ label, onPress, variant = 'primary', loading, disabled, style, accessibilityLabel }: Props) {
  const { colors, radius, spacing, typography, motion } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, motion.spring.micro);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, motion.spring.micro);
  };

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => {
          if (!disabled && !loading) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onPress();
          }
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: disabled || loading }}
        style={[
          styles.base,
          {
            backgroundColor: isPrimary ? colors.primary : 'transparent',
            borderColor: colors.primary,
            borderWidth: isPrimary ? 0 : 1.5,
            borderRadius: radius.pill,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.lg,
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isPrimary ? colors.surface : colors.primary} />
        ) : (
          <Text
            style={[
              typography.bodyMedium,
              { color: isPrimary ? colors.surface : colors.primary, textAlign: 'center' },
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
