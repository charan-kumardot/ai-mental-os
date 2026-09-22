import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 54;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Ring({
  ratio,
  label,
  value,
  color,
}: {
  ratio: number;
  label: string;
  value: string;
  color: string;
}) {
  const { colors, spacing, typography } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [ratio]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <Text style={[typography.micro, { color, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
        {label}
      </Text>
      {/* Keyed by value so a real change (e.g. after pull-to-refresh brings
          new data) cross-fades in rather than snapping — a level that just
          replaces itself instantly reads as static, not alive. */}
      <Animated.Text
        key={value}
        entering={FadeIn.duration(300)}
        style={[typography.caption, { color: colors.textPrimary, fontWeight: '700' }]}
      >
        {value}
      </Animated.Text>
    </View>
  );
}
