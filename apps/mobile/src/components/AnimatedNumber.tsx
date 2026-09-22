import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Counts up to a real value instead of snapping in — a number that just
 * appears reads as static data; one that visibly arrives reads as alive.
 * Values that aren't plain numbers (e.g. "Above normal", "Good") render
 * immediately, unchanged, so this is safe to use generically wherever a
 * StatTile/count could show either a number or a label.
 */
export function AnimatedNumber({ value, style, duration = 700 }: { value: string | number; style?: StyleProp<TextStyle>; duration?: number }) {
  const { reduceMotion } = useTheme();
  const numeric = typeof value === 'number' ? value : Number(value);
  const isAnimatable = typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value).trim());
  const [display, setDisplay] = useState(isAnimatable && !reduceMotion ? 0 : numeric);

  useEffect(() => {
    if (!isAnimatable || reduceMotion) {
      setDisplay(numeric);
      return;
    }
    const start = performance.now();
    let frame: ReturnType<typeof requestAnimationFrame>;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(eased * numeric));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric, reduceMotion, isAnimatable]);

  return <Text style={style}>{isAnimatable ? display : value}</Text>;
}
