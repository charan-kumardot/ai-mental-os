import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import Svg, { Path, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { StateLevel } from '../lib/stateEngine';

/**
 * The user's current internal context — distinct from AIOrb, which
 * represents the AI itself (spec §13-14). Several overlapping, irregular,
 * translucent blob shapes (not concentric circles) so it reads as a living
 * nebula — one per real tracked dimension (energy/recovery/mental load),
 * plus a bright core and a scatter of slow-twinkling particles. A
 * dimension with no real source is simply absent, never guessed. With no
 * data at all, renders one calm, low-opacity form instead of implying a
 * reading that doesn't exist yet.
 */

// One hand-authored organic silhouette (normalized to a 100x100 box),
// reused per layer at different rotation/scale/offset so each instance
// reads as a distinct wisp rather than a repeated identical shape.
const BLOB_PATH =
  'M50,6 C69,5 90,20 94,41 C97,60 89,79 71,89 C54,98 30,95 15,80 C2,66 2,42 13,26 C24,11 37,9 50,6 Z';

function Blob({ color, opacity, coreOpacity, transform }: { color: string; opacity: number; coreOpacity?: number; transform?: string }) {
  const gradId = `psv-${color.replace('#', '')}-${Math.round(opacity * 1000)}`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={gradId} cx="45%" cy="40%" r="65%">
          <Stop offset="0%" stopColor={color} stopOpacity={coreOpacity ?? opacity} />
          <Stop offset="60%" stopColor={color} stopOpacity={opacity * 0.55} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G transform={transform}>
        <Path d={BLOB_PATH} fill={`url(#${gradId})`} />
      </G>
    </Svg>
  );
}

function Particle({ color, left, top, r, delay, reduceMotion }: { color: string; left: number; top: number; r: number; delay: number; reduceMotion: boolean }) {
  const twinkle = useSharedValue(0.2);
  useEffect(() => {
    cancelAnimation(twinkle);
    if (reduceMotion) {
      twinkle.value = 0.45;
      return;
    }
    twinkle.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 1600 + delay, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.12, { duration: 1600 + delay, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(twinkle);
  }, [reduceMotion, delay]);
  const style = useAnimatedStyle(() => ({ opacity: twinkle.value }));
  return (
    <Animated.View style={[{ position: 'absolute', left: left - r, top: top - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: color }, style]} />
  );
}

/** low = slower + more compressed, high = brighter + more directional, moderate = balanced. */
const LEVEL_DURATION: Record<StateLevel, number> = { low: 8600, moderate: 6200, high: 4400 };
const LEVEL_SCALE: Record<StateLevel, [number, number]> = { low: [0.86, 0.96], moderate: [0.93, 1.07], high: [1, 1.18] };
const LEVEL_OPACITY: Record<StateLevel, number> = { low: 0.36, moderate: 0.46, high: 0.58 };

function useLayerMotion(level: StateLevel | null | undefined, reduceMotion: boolean, phaseOffset: number) {
  const scale = useSharedValue(1);
  const drift = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(drift);
    cancelAnimation(rotate);
    const lvl: StateLevel = level ?? 'moderate';
    const duration = LEVEL_DURATION[lvl];
    const [from, to] = LEVEL_SCALE[lvl];

    if (reduceMotion) {
      scale.value = withTiming((from + to) / 2, { duration: 300 });
      return;
    }

    scale.value = withRepeat(
      withSequence(
        withTiming(to, { duration: duration + phaseOffset, easing: Easing.inOut(Easing.sin) }),
        withTiming(from, { duration: duration + phaseOffset, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration * 1.5 + phaseOffset, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: duration * 1.5 + phaseOffset, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    rotate.value = withRepeat(withTiming(360, { duration: duration * 4.5 + phaseOffset, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(scale);
      cancelAnimation(drift);
      cancelAnimation(rotate);
    };
  }, [level, reduceMotion, phaseOffset]);

  return { scale, drift, rotate };
}

export function PersonalStateVisualization({
  energy,
  recovery,
  mentalLoad,
  size = 280,
}: {
  energy?: StateLevel | null;
  recovery?: StateLevel | null;
  mentalLoad?: StateLevel | null;
  size?: number;
}) {
  const { colors, reduceMotion } = useTheme();
  const hasAnyData = energy != null || recovery != null || mentalLoad != null;

  // Mental load is inverted — "high" here should read as less settled, not brighter.
  const mentalLoadInverted: StateLevel | null =
    mentalLoad === 'high' ? 'low' : mentalLoad === 'low' ? 'high' : mentalLoad ?? null;

  const energyMotion = useLayerMotion(energy, reduceMotion, 0);
  const recoveryMotion = useLayerMotion(recovery, reduceMotion, 900);
  const loadMotion = useLayerMotion(mentalLoadInverted, reduceMotion, 1700);
  const violetMotion = useLayerMotion('moderate', reduceMotion, 2400);
  const coreMotion = useLayerMotion('high', reduceMotion, 300);

  const energyStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${energyMotion.rotate.value * 0.4}deg` },
      { translateX: -size * 0.1 + energyMotion.drift.value * size * 0.05 },
      { translateY: -size * 0.06 },
      { scale: energyMotion.scale.value },
    ],
  }));
  const recoveryStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-recoveryMotion.rotate.value * 0.3}deg` },
      { translateX: size * 0.09 },
      { translateY: -size * 0.08 + recoveryMotion.drift.value * -size * 0.04 },
      { scale: recoveryMotion.scale.value },
    ],
  }));
  const loadStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${loadMotion.rotate.value * 0.35}deg` },
      { translateX: size * 0.04 + loadMotion.drift.value * -size * 0.05 },
      { translateY: size * 0.1 },
      { scale: loadMotion.scale.value },
    ],
  }));
  const violetStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-violetMotion.rotate.value * 0.25}deg` },
      { translateX: -size * 0.07 + violetMotion.drift.value * size * 0.04 },
      { translateY: size * 0.09 },
      { scale: violetMotion.scale.value },
    ],
  }));
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: coreMotion.scale.value }] }));

  const particleColors = [colors.textPrimary, colors.primary, colors.secondary, colors.textPrimary, colors.accentLavender, colors.textPrimary, colors.primary, colors.textPrimary];
  const particles = Array.from({ length: 10 }).map((_, i) => {
    const angle = (i / 10) * Math.PI * 2 + i * 0.5;
    const dist = 0.22 + ((i * 37) % 25) / 100; // spread 0.22–0.47 of size, deterministic
    return {
      left: size / 2 + Math.cos(angle) * size * dist,
      top: size / 2 + Math.sin(angle) * size * dist * 0.85,
      r: 1.1 + ((i * 13) % 10) / 10,
      delay: (i * 250) % 1400,
      color: particleColors[i % particleColors.length],
    };
  });

  if (!hasAnyData) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <BlurView
          intensity={Platform.OS === 'android' ? 30 : 25}
          tint="dark"
          style={{ position: 'absolute', width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31, overflow: 'hidden' }}
        />
        <Animated.View style={[styles.layerWrap, coreStyle, { width: size * 0.66, height: size * 0.66 }]}>
          <Blob color={colors.aiAccent} opacity={0.5} coreOpacity={0.78} />
        </Animated.View>
        {particles.slice(0, 4).map((p, i) => (
          <Particle key={i} color={p.color} left={p.left} top={p.top} r={p.r} delay={p.delay} reduceMotion={reduceMotion} />
        ))}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <BlurView
        intensity={Platform.OS === 'android' ? 28 : 22}
        tint="dark"
        style={{ position: 'absolute', width: size * 0.85, height: size * 0.85, borderRadius: size * 0.42, overflow: 'hidden' }}
      />
      <Animated.View style={[styles.layerWrap, recoveryStyle, { width: size * 0.8, height: size * 0.8 }]}>
        <Blob color={colors.secondary} opacity={LEVEL_OPACITY[recovery ?? 'moderate']} transform="rotate(24 50 50)" />
      </Animated.View>
      <Animated.View style={[styles.layerWrap, loadStyle, { width: size * 0.74, height: size * 0.74 }]}>
        <Blob color={colors.accentLavender} opacity={LEVEL_OPACITY[mentalLoadInverted ?? 'moderate']} transform="rotate(-32 50 50) scale(1.08,0.94)" />
      </Animated.View>
      <Animated.View style={[styles.layerWrap, violetStyle, { width: size * 0.68, height: size * 0.68 }]}>
        <Blob color={colors.accentViolet} opacity={0.3} transform="rotate(60 50 50) scale(0.92,1.05)" />
      </Animated.View>
      <Animated.View style={[styles.layerWrap, energyStyle, { width: size * 0.62, height: size * 0.62 }]}>
        <Blob color={colors.primary} opacity={LEVEL_OPACITY[energy ?? 'moderate']} transform="rotate(-12 50 50) scale(1.05,0.96)" />
      </Animated.View>
      <Animated.View style={[styles.layerWrap, coreStyle, { width: size * 0.32, height: size * 0.32 }]}>
        <Blob color={colors.aiAccent} opacity={0.55} coreOpacity={0.85} />
      </Animated.View>
      {particles.map((p, i) => (
        <Particle key={i} color={p.color} left={p.left} top={p.top} r={p.r} delay={p.delay} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layerWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
