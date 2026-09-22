import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { GlassCard } from './GlassCard';
import { AIOrb } from './AIOrb';
import { EvidenceBadge } from './EvidenceBadge';

/**
 * Spec §86 "Discovery Reveal" — a sequenced cinematic moment for a pattern
 * found in THIS session (as opposed to `DiscoveryCard`, used for the
 * plain list of already-known discoveries): orb activates, then headline,
 * then the finding itself, then the evidence — each beat arriving after
 * the last, not all at once. Respects Reduce Motion by collapsing every
 * delay to zero so the content still appears, just without the sequence.
 */
export function DiscoveryReveal({
  title,
  body,
  confidence,
  evidenceCount,
}: {
  title: string;
  body: string;
  confidence?: number;
  evidenceCount?: number;
}) {
  const { colors, spacing, typography, reduceMotion } = useTheme();
  const glow = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!reduceMotion) {
      glow.value = withSequence(withTiming(1, { duration: 600 }), withTiming(0.5, { duration: 800 }));
    } else {
      glow.value = 0.5;
    }
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.15 + glow.value * 0.35,
  }));

  const delay = (ms: number) => (reduceMotion ? 0 : ms);

  return (
    <Animated.View
      style={[
        { shadowColor: colors.aiAccent, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
        glowStyle,
      ]}
    >
      <GlassCard tint="accent">
        <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
          <AIOrb state="insight" size={56} />
        </View>

        <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(delay(250)).duration(400)}>
          <Text style={[typography.micro, { color: colors.aiAccent, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginBottom: spacing.sm }]}>
            ✨ You discovered something
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(delay(650)).duration(500)}>
          <Text style={[typography.headline, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm }]}>
            {title}
          </Text>
          <Text style={[typography.insightQuote, { color: colors.textSecondary, textAlign: 'center' }]}>{body}</Text>
        </Animated.View>

        {typeof confidence === 'number' && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(delay(1150)).duration(400)} style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <EvidenceBadge confidence={confidence} evidenceCount={evidenceCount} />
          </Animated.View>
        )}
      </GlassCard>
    </Animated.View>
  );
}
