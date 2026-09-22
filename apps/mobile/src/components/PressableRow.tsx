import React from 'react';
import { Pressable, ViewStyle } from 'react-native';

/**
 * Reusable tappable row — Pressable (not View+onTouchEnd). Plain Views
 * with onTouchEnd are unreliable for real touch input (confirmed via
 * device testing: worked inconsistently with both synthetic and some
 * real taps), since they bypass RN's gesture responder system that
 * Pressable relies on. Always use this (or PrimaryButton) for tappable
 * UI, never a bare View with a touch handler.
 */
export function PressableRow({
  onPress,
  children,
  style,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}
