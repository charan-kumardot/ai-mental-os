import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { darkColors, ambient, spacing, radius, typography, motion, ColorTokens } from './tokens';

type ThemeContextValue = {
  colors: ColorTokens;
  ambient: typeof ambient;
  scheme: 'dark';
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  motion: typeof motion;
  reduceMotion: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: darkColors,
      ambient,
      scheme: 'dark',
      spacing,
      radius,
      typography,
      motion,
      reduceMotion,
    }),
    [reduceMotion]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
