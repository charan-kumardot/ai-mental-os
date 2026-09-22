import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { AIOrb } from './AIOrb';

function Ripple({ delay, color, reduceMotion }: { delay: number; color: string; reduceMotion: boolean }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1, false)
    );
    opacity.value = withDelay(delay, withRepeat(withSequence(withTiming(0.55, { duration: 200 }), withTiming(0, { duration: 2000 })), -1, false));
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [delay, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: reduceMotion ? 0 : opacity.value,
  }));

  return <Animated.View style={[styles.ripple, style, { borderColor: color }]} />;
}

function Sparkle({ top, left, delay, reduceMotion }: { top: number; left: number; delay: number; reduceMotion: boolean }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = () => {
      scale.value = withDelay(delay, withSequence(withTiming(1.1, { duration: 500 }), withTiming(0.5, { duration: 600 })));
      opacity.value = withDelay(delay, withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 600 })));
    };
    loop();
    const interval = setInterval(loop, 2600);
    return () => clearInterval(interval);
  }, [delay, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: reduceMotion ? 0 : opacity.value,
  }));

  return (
    <Animated.Text style={[styles.sparkle, style, { top, left }]} pointerEvents="none">
      ✦
    </Animated.Text>
  );
}

/**
 * Cinematic check-in success moment — expanding ripples + sparkle accents
 * around the orb, per the approved design preview. No streak language, no
 * pressure (spec section 108) — just a brief, warm acknowledgment.
 */
export function SuccessBurst({ subtitle }: { subtitle: string }) {
  const { colors, spacing, typography, reduceMotion } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.orbArea}>
        <Ripple delay={0} color={colors.success} reduceMotion={reduceMotion} />
        <Ripple delay={800} color={colors.success} reduceMotion={reduceMotion} />
        <Sparkle top={10} left={70} delay={200} reduceMotion={reduceMotion} />
        <Sparkle top={70} left={10} delay={1100} reduceMotion={reduceMotion} />
        <AIOrb state="success" size={56} />
      </View>
      <Text style={[typography.headline, { color: colors.textPrimary, marginTop: spacing.md }]}>Noted.</Text>
      <Text
        style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxs, maxWidth: 260 }]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  orbArea: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  ripple: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
  },
  sparkle: { position: 'absolute', fontSize: 16, color: '#C9A876' },
});
