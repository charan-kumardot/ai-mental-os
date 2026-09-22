import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

const { width, height } = Dimensions.get('window');

/**
 * Slow-drifting soft color blobs behind blurred glass surfaces.
 * This is what makes GlassCard's blur actually read as "glass" —
 * blur needs real color/variation behind it. Deliberately NOT blurred
 * here itself: GlassCard applies its own BlurView per-card, and a second
 * blur pass on the background first would desaturate the blobs into flat
 * near-white before that card blur ever sees them, making every card read
 * as a plain white rectangle instead of frosted glass.
 */
function Blob({ color, size, opacity }: { color: string; size: number; opacity: number }) {
  // Soft-edged via an SVG radial gradient fading to transparent, rather than
  // a hard-edge circle needing a blur pass to soften it — reuses the same
  // RadialGradient pattern already used in AIOrb/PersonalGraph.
  const gradId = `blob-${color.replace('#', '')}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="70%" stopColor={color} stopOpacity={opacity * 0.6} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradId})`} />
    </Svg>
  );
}

/** Which blob leans forward changes with real time of day — cooler/indigo
 * in the morning and at night, warmer/sand-toned in the evening. Not a
 * literal clock display, just a very quiet ambient cue the app is aware
 * of when "now" actually is, tied to the same hour used for the greeting. */
function timeOfDayWeights(hour: number) {
  if (hour >= 22 || hour < 5) return { indigo: 1.1, lavender: 0.85, sand: 0.5 }; // night
  if (hour < 11) return { indigo: 1.15, lavender: 1.0, sand: 0.55 }; // morning
  if (hour < 17) return { indigo: 1.0, lavender: 1.0, sand: 0.8 }; // midday
  return { indigo: 0.85, lavender: 0.95, sand: 1.3 }; // evening
}

export type AmbientState = 'calm' | 'focus' | 'recovery' | 'reflection' | 'live' | 'alert';

export function AmbientBackground({
  liveliness = 0.7,
  state,
}: {
  liveliness?: number;
  /** Context the ambient glow should reflect (spec §5) — omit to keep the default time-of-day blend. */
  state?: AmbientState;
}) {
  const { colors, ambient, scheme, reduceMotion } = useTheme();
  const ambientPair = state ? ambient[state] : null;
  const drift1 = useSharedValue(0);
  const drift2 = useSharedValue(0);

  // Clamp — a caller passing a real but extreme value (e.g. a bug upstream)
  // should never fully hide the background or blow out its opacity.
  const life = Math.max(0.35, Math.min(1, liveliness));
  const weights = useMemo(() => timeOfDayWeights(new Date().getHours()), []);

  useEffect(() => {
    if (reduceMotion) return;
    // Higher liveliness (real energy/recovery reads as "up") drifts faster —
    // this is the one purely decorative element in the app actually
    // reflecting real state instead of being pure wallpaper.
    const baseDuration1 = 14000 / (0.6 + life * 0.6);
    const baseDuration2 = 18000 / (0.6 + life * 0.6);
    drift1.value = withRepeat(withTiming(1, { duration: baseDuration1, easing: Easing.inOut(Easing.sin) }), -1, true);
    drift2.value = withRepeat(withTiming(1, { duration: baseDuration2, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduceMotion, life]);

  const blob1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift1.value * 40 - 20 },
      { translateY: drift1.value * -30 + 15 },
    ],
  }));
  const blob2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift2.value * -35 + 15 },
      { translateY: drift2.value * 25 - 10 },
    ],
  }));

  const dim = scheme === 'dark' ? 0.85 : 1;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, overflow: 'hidden' }]} pointerEvents="none">
      <Animated.View style={[styles.blob, blob1Style, { width: width * 0.95, height: width * 0.95, top: -width * 0.35, left: -width * 0.3 }]}>
        <Blob color={ambientPair?.primary ?? colors.aiAccent} size={width * 0.95} opacity={0.22 * dim * life * weights.indigo} />
      </Animated.View>
      <Animated.View style={[styles.blob, blob2Style, { width: width * 0.85, height: width * 0.85, top: height * 0.32, right: -width * 0.32 }]}>
        <Blob color={ambientPair?.secondary ?? colors.accentLavender} size={width * 0.85} opacity={0.18 * dim * life * weights.lavender} />
      </Animated.View>
      <View style={[styles.blob, { width: width * 0.75, height: width * 0.75, bottom: -width * 0.28, left: width * 0.05 }]}>
        <Blob color={colors.accentSand} size={width * 0.75} opacity={0.14 * dim * life * weights.sand} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute' },
});
