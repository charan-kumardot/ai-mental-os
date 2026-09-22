import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A small pulsing dot signaling "this is live right now" — used on Live
 * Session and presence rows so the realtime layer reads as genuinely alive
 * rather than a static list, without adding any new fake data.
 */
export function LivePulseDot({ color }: { color?: string }) {
  const { colors, reduceMotion } = useTheme();
  const dotColor = color ?? colors.success;
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withRepeat(withTiming(1.6, { duration: 900, easing: Easing.out(Easing.ease) }), -1, true);
  }, [reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 2 - scale.value }));

  return (
    <View style={{ width: 8, height: 8 }}>
      <View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      <Animated.View style={[{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }, style]} />
    </View>
  );
}
