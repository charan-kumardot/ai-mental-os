import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

export interface ChartPoint {
  label: string;
  value: number;
}

/**
 * Real sparkline (spec §105's AnimatedChart) — draws only the points it's
 * given, animating the line in once on mount/update rather than showing a
 * static shape. Deliberately refuses to render below 2 points: a "trend"
 * drawn from a single real value would visually imply a shape that isn't
 * there, which is the same fabrication the rest of the app refuses to do
 * with numbers. Callers own the honest empty-state copy for that case.
 */
export function AnimatedChart({
  points,
  width = 260,
  height = 70,
  color,
}: {
  points: ChartPoint[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const lineColor = color ?? colors.aiAccent;
  const progress = useSharedValue(0);

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 6;
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: padding + i * stepX,
    y: padding + (height - padding * 2) * (1 - (p.value - min) / range),
  }));
  const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const perimeter =
    coords.reduce((acc, c, i) => (i === 0 ? 0 : acc + Math.hypot(c.x - coords[i - 1].x, c.y - coords[i - 1].y)), 0) || 1;

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsStr]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - progress.value) * perimeter,
  }));

  if (points.length < 2) return null;

  return (
    <View>
      <Svg width={width} height={height}>
        <AnimatedPolyline
          points={pointsStr}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={`${perimeter} ${perimeter}`}
          animatedProps={animatedProps}
        />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={3} fill={lineColor} />
        ))}
      </Svg>
    </View>
  );
}
