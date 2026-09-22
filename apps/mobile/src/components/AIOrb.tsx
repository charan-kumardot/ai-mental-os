import React, { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
  FadeIn,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type OrbState = 'idle' | 'listening' | 'thinking' | 'learning' | 'insight' | 'success' | 'uncertainty';

const STATE_SCALE: Record<OrbState, number> = {
  idle: 1,
  listening: 1.08,
  thinking: 1,
  learning: 1.04,
  insight: 1.12,
  success: 1.1,
  uncertainty: 0.96,
};

/**
 * Abstract Personal Intelligence Orb — never a humanoid avatar.
 * Layers: soft blurred halo, radial-gradient core, and a thin orbiting
 * ring that rotates continuously and speeds up in active states.
 */
export function AIOrb({ state = 'idle', size = 96 }: { state?: OrbState; size?: number }) {
  const { colors, reduceMotion, motion, scheme } = useTheme();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.5);
  const rotation = useSharedValue(0);
  const ringOffset = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(glow);
    cancelAnimation(rotation);
    cancelAnimation(ringOffset);

    const targetScale = STATE_SCALE[state];
    const ringDuration = state === 'idle' ? 22000 : state === 'listening' || state === 'thinking' ? 3500 : 9000;
    rotation.value = withRepeat(withTiming(360, { duration: ringDuration, easing: Easing.linear }), -1, false);
    ringOffset.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), withTiming(0.35, { duration: 1400 })),
      -1,
      true
    );

    if (reduceMotion) {
      scale.value = withTiming(targetScale, { duration: motion.duration.fast });
      glow.value = withTiming(state === 'idle' ? 0.5 : 0.8, { duration: motion.duration.fast });
      return;
    }

    if (state === 'idle') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: motion.duration.ambient, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: motion.duration.ambient, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
      glow.value = withRepeat(
        withSequence(withTiming(0.65, { duration: motion.duration.ambient }), withTiming(0.4, { duration: motion.duration.ambient })),
        -1,
        false
      );
    } else if (state === 'listening' || state === 'thinking') {
      scale.value = withRepeat(
        withSequence(
          withTiming(targetScale, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(targetScale - 0.03, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow.value = withTiming(0.9, { duration: motion.duration.normal });
    } else {
      scale.value = withSequence(
        withTiming(targetScale, { duration: motion.duration.normal, easing: Easing.out(Easing.back(1.5)) }),
        withTiming(targetScale - 0.02, { duration: motion.duration.slow })
      );
      glow.value = withTiming(0.85, { duration: motion.duration.normal });
    }
  }, [state, reduceMotion]);

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: scale.value * 1.5 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: 100 - ringOffset.value * 60,
  }));

  const orbColor = state === 'success' ? colors.success : state === 'uncertainty' ? colors.warning : colors.aiAccent;
  const ringRadius = size * 0.46;
  const circumference = 2 * Math.PI * ringRadius;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(400)}
      style={[styles.container, { width: size * 2, height: size * 2 }]}
    >
      <BlurView
        intensity={Platform.OS === 'android' ? 30 : 25}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={[styles.blurHalo, { width: size * 1.6, height: size * 1.6, borderRadius: size * 0.8 }]}
      />
      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: orbColor },
        ]}
      />

      <Animated.View style={[styles.ringWrap, ringStyle, { width: size * 1.4, height: size * 1.4 }]}>
        <Svg width={size * 1.4} height={size * 1.4} viewBox={`0 0 ${size * 1.4} ${size * 1.4}`}>
          <AnimatedCircle
            cx={(size * 1.4) / 2}
            cy={(size * 1.4) / 2}
            r={ringRadius}
            stroke={orbColor}
            strokeWidth={1.5}
            strokeOpacity={0.5}
            fill="none"
            strokeDasharray={`${circumference * 0.4} ${circumference * 0.6}`}
            animatedProps={ringProps}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.orbWrap, orbStyle, { width: size * 0.62, height: size * 0.62 }]}>
        <Svg width={size * 0.62} height={size * 0.62}>
          <Defs>
            <RadialGradient id="orbGrad" cx="35%" cy="30%" r="75%">
              <Stop offset="0%" stopColor={orbColor} stopOpacity={1} />
              <Stop offset="100%" stopColor={orbColor} stopOpacity={0.75} />
            </RadialGradient>
          </Defs>
          <Circle cx={(size * 0.62) / 2} cy={(size * 0.62) / 2} r={(size * 0.62) / 2} fill="url(#orbGrad)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  blurHalo: { position: 'absolute', overflow: 'hidden' },
  glow: { position: 'absolute', opacity: 0.4 },
  ringWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  orbWrap: {},
});
