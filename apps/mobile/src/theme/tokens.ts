/**
 * Design tokens for the Personal Intelligence Surface — Dark Spatial system.
 * One deep, warm-near-black environment (never pure black), lit by ambient
 * glow rather than flat surfaces. No color alone ever communicates
 * health/safety state — always paired with text/icon.
 */

export const darkColors = {
  // Warm near-black tiers, never flat/pure black (spec §4).
  background: '#0B0D0C',
  backgroundElevated: '#111311',
  surface: '#15181A',
  surfaceElevated: '#1B1E1B',
  border: '#2A2D28',
  textPrimary: '#F1EEE7', // warm white
  textSecondary: '#A6A296', // muted warm gray
  textMuted: '#6D6A60', // low-contrast neutral
  primary: '#7CAE93', // muted intelligent green
  primarySoft: '#20342B',
  secondary: '#7C9CC4', // soft blue
  secondarySoft: '#21303F',
  accentLavender: '#9B8FC4', // muted lavender
  accentSand: '#C9A876', // warm sand
  accentViolet: '#8B85D6', // subtle violet
  aiAccent: '#8B90E0',
  success: '#7CAE93',
  warning: '#C99A5C',
  critical: '#C97066',
  overlay: 'rgba(4, 5, 4, 0.6)',
} as const;

/**
 * Ambient lighting per ai-state/context (spec §5) — used by AmbientBackground
 * to pick which pair of glow colors the drifting blobs render with. Every
 * pairing stays low-saturation; no neon/rainbow combinations.
 */
export const ambient = {
  calm: { primary: '#7CAE93', secondary: '#7C9CC4' },
  focus: { primary: '#5C8AA3', secondary: '#4F8F7A' },
  recovery: { primary: '#7CAE93', secondary: '#6FBE9C' },
  reflection: { primary: '#9B8FC4', secondary: '#8B85D6' },
  live: { primary: '#7FD9B0', secondary: '#6FC9E0' },
  alert: { primary: '#C99A5C', secondary: '#C97066' },
} as const;

export type ColorTokens = typeof darkColors;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  hero: 28,
  pill: 999,
} as const;

// Sora for anything display/emphasis (headlines, card titles, hero numbers),
// Manrope for everything read as body/data — this is the project's original
// approved type pairing (see the design-reference artifact from session
// one), not a new choice. No fontWeight alongside these custom fontFamily
// values — on Android, RN tries to resolve a combined "family+weight"
// variant and silently falls back to the system font when one doesn't
// exist, so each style below points at the exact pre-weighted font file
// instead.
const displayBold = 'Sora_700Bold';
const displaySemiBold = 'Sora_600SemiBold';

export const typography = {
  hero: { fontSize: 40, lineHeight: 45, letterSpacing: -0.5, fontFamily: displayBold },
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.3, fontFamily: displayBold },
  title: { fontSize: 22, lineHeight: 28, fontFamily: displayBold },
  headline: { fontSize: 18, lineHeight: 24, fontFamily: displaySemiBold },
  body: { fontSize: 16, lineHeight: 23, fontFamily: 'Manrope_400Regular' },
  bodyMedium: { fontSize: 16, lineHeight: 23, fontFamily: 'Manrope_600SemiBold' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_400Regular' },
  micro: { fontSize: 11, lineHeight: 15, fontFamily: 'Manrope_600SemiBold' },
  // AI-generated narrative/insight text (weekly review narrative, micro-
  // insights) — kept visually distinct from measured data via an italic
  // style rather than a separate serif family, per the original mockup's
  // sans-only type system.
  insightQuote: { fontSize: 17, lineHeight: 25, fontStyle: 'italic' as const, fontFamily: 'Manrope_500Medium' },
};

/**
 * Motion tokens — centralized so no arbitrary animation values are scattered
 * through screens. `ambient` is used for the AI Orb's idle breathing loop.
 */
export const motion = {
  spring: {
    micro: { damping: 20, stiffness: 300 },
    normal: { damping: 18, stiffness: 180 },
    slow: { damping: 22, stiffness: 90 },
  },
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
    ambient: 3200,
    // Per-item delay for staggered list/grid entrance animations (§106 —
    // centralized here so no screen hardcodes its own stagger value).
    stagger: 60,
  },
} as const;
