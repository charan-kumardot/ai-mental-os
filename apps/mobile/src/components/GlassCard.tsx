import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The app's base surface. Per spec §11, glassmorphism is NOT the default
 * visual language — most surfaces are a flat, subtly-elevated tonal fill.
 * `elevated` opts a specific instance (bottom sheets, modals) into the
 * frosted-blur treatment, reserved for genuinely elevated moments.
 *
 * Deliberately a SINGLE View with one background color in the common
 * (non-elevated) case — an earlier version nested a bordered/shadowed
 * outer View around a separately-filled inner View, which rendered as a
 * visible two-tone "rectangle inside a rectangle" on-device (confirmed via
 * screenshot, not just a border/shadow tuning issue). Nesting is only used
 * for `elevated`, where a blur layer genuinely needs to sit behind the fill.
 */
export function GlassCard({
  children,
  style,
  tint = 'none',
  compact = false,
  elevated = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional faint colored glow so cards read as distinct surfaces rather than identical tonal boxes. */
  tint?: 'none' | 'accent' | 'primary';
  /** Smaller inner padding for bento/grid tiles, where a full-size card's padding reads oversized. */
  compact?: boolean;
  /** Opt into the frosted-glass/blur treatment — reserved for sheets, modals, and other genuinely elevated surfaces. */
  elevated?: boolean;
}) {
  const { colors, radius, spacing } = useTheme();
  const glowColor = tint === 'accent' ? colors.aiAccent : tint === 'primary' ? colors.primary : null;
  const padding = compact ? spacing.sm : spacing.lg;
  const borderColor = glowColor ? glowColor + '33' : 'rgba(255,255,255,0.07)';

  if (!elevated) {
    return (
      <View
        style={[
          {
            borderRadius: radius.lg,
            borderWidth: glowColor ? 1.5 : 1,
            // The fill is always fully opaque `colors.surface` — never a
            // background blended with the tint at low alpha. A translucent
            // fill let whatever sits behind the card (the ambient glow)
            // show through unevenly at the edges, which on-device looked
            // exactly like a second, lighter rounded-rect ring around the
            // card rather than one tinted surface (confirmed empirically:
            // swapping in fully-opaque debug colors made the "ring"
            // disappear completely). The tint now reads only through a
            // more visible colored border, which can't blend with the
            // background because it never carries any transparency tied to
            // what's behind the card.
            borderColor: glowColor ? glowColor + '80' : 'rgba(255,255,255,0.07)',
            backgroundColor: colors.surface,
            padding,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View style={[{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor }, style]}>
      <BlurView intensity={Platform.OS === 'android' ? 55 : 40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={{ backgroundColor: 'rgba(21,24,26,0.86)', padding }}>{children}</View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }}
      />
    </View>
  );
}
