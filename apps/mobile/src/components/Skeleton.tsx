import React, { useEffect } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

/** One shimmering placeholder block. */
function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors, reduceMotion } = useTheme();
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: reduceMotion ? 0.6 : pulse.value }));

  return <Animated.View style={[{ backgroundColor: colors.border, borderRadius: 8 }, animatedStyle, style]} />;
}

/**
 * A content-shaped loading placeholder instead of a bare spinner — the
 * shape of what's coming (a card, a couple of text lines) reads as "the
 * app already knows what it's about to show you," which a generic
 * ActivityIndicator never communicates.
 */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <SkeletonBlock style={{ width: '55%', height: 16 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} style={{ width: i === lines - 1 ? '70%' : '100%', height: 12 }} />
      ))}
    </View>
  );
}

export function SkeletonRow({ width = 80, height = 14 }: { width?: number | `${number}%`; height?: number }) {
  return <SkeletonBlock style={{ width, height }} />;
}
