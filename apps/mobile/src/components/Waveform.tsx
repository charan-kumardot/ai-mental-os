import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

const BAR_COUNT = 8;
const MIN_H = 8;
const MAX_H = 40;
// Per-bar sensitivity spread so a real amplitude reads as an organic
// waveform rather than every bar moving in lockstep.
const BAR_WEIGHT = [0.5, 0.8, 1, 0.65, 0.9, 0.55, 0.75, 0.6];

function Bar({ delay, color, reduceMotion, level, weight }: { delay: number; color: string; reduceMotion: boolean; level?: number; weight: number }) {
  const height = useSharedValue(MIN_H);
  const isLive = typeof level === 'number';

  // Canned loop only when there's no real amplitude to drive from.
  useEffect(() => {
    if (isLive) return;
    if (reduceMotion) {
      height.value = MIN_H + (MAX_H - MIN_H) * 0.4;
      return;
    }
    height.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(MAX_H, { duration: 550, easing: Easing.inOut(Easing.sin) }),
          withTiming(MIN_H, { duration: 550, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(height);
  }, [delay, reduceMotion, isLive]);

  // Real microphone amplitude drives the target height directly — a spring
  // (not a fixed-duration tween) so it settles naturally between updates
  // instead of visibly stepping.
  useEffect(() => {
    if (!isLive) return;
    cancelAnimation(height);
    const target = MIN_H + (MAX_H - MIN_H) * Math.max(0, Math.min(1, (level as number) * weight));
    height.value = reduceMotion ? target : withSpring(target, { damping: 12, stiffness: 120 });
  }, [level, isLive, reduceMotion, weight]);

  const style = useAnimatedStyle(() => ({ height: height.value }));

  return <Animated.View style={[styles.bar, style, { backgroundColor: color }]} />;
}

/**
 * Live "listening" waveform, per spec §76. When `level` (real microphone
 * amplitude, 0–1, from expo-audio's metering) is passed, bars are driven by
 * actual voice volume — genuinely listening, not a decorative loop. Falls
 * back to the canned animation only when no live level is available yet.
 */
export function Waveform({ active = true, level }: { active?: boolean; level?: number }) {
  const { colors, reduceMotion } = useTheme();
  if (!active) return null;
  return (
    <View style={styles.row}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <Bar key={i} delay={(i % 4) * 110} color={colors.aiAccent} reduceMotion={reduceMotion} level={level} weight={BAR_WEIGHT[i]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 48 },
  bar: { width: 4, borderRadius: 2 },
});
