import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { AIOrb } from '../src/components/AIOrb';
import { EvidenceBadge } from '../src/components/EvidenceBadge';
import { fetchLongTermJourney, JourneyBeat, LongTermJourneyResult } from '../src/lib/longTermJourney';
import { staggerEntering } from '../src/lib/entrance';

function iconFor(beat: JourneyBeat): keyof typeof Feather.glyphMap {
  const other = beat.dimensionA === 'mood' ? beat.dimensionB : beat.dimensionA;
  if (other === 'sleepMinutes') return 'moon';
  if (other === 'steps') return 'activity';
  if (other === 'meetingCount' || other === 'meetingMinutes') return 'calendar';
  return 'trending-up';
}

/**
 * Long-Term Journey / "You've changed" (spec §40, §83) — an animated
 * month-by-month timeline of which real relationship was strongest each
 * month. Every beat is recomputed fresh from that month's own data (see
 * functions/generate-insight/src/longTermJourney.js); a month with no real
 * pattern simply doesn't appear, never filled in with a guess.
 */
export default function YourStory() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<LongTermJourneyResult | null>(null);

  useEffect(() => {
    fetchLongTermJourney().then(setResult).finally(() => setLoading(false));
  }, []);

  const beats = result?.beats ?? [];

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Your story" orbState={loading ? 'thinking' : beats.length > 0 ? 'insight' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          What's actually shifted, month by month — only real, recomputed relationships, nothing carried over from
          memory.
        </Text>

        {!loading && result?.skipped && (
          <GlassCard>
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <AIOrb size={44} state="idle" />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
                Nothing to show yet
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs, textAlign: 'center', maxWidth: 280 }]}>
                {result.message}
              </Text>
            </View>
          </GlassCard>
        )}

        {!loading && beats.length > 0 && (
          <GlassCard>
            {beats.map((beat, i) => {
              const isLast = i === beats.length - 1;
              return (
                <Animated.View key={beat.monthKey} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ alignItems: 'center', width: 32 }}>
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: colors.aiAccent + '26',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name={iconFor(beat)} size={13} color={colors.aiAccent} />
                      </View>
                      {!isLast && <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border, marginVertical: 4 }} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.lg, paddingLeft: spacing.sm }}>
                      <Text style={[typography.micro, { color: colors.aiAccent, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                        {beat.label}
                      </Text>
                      <Text style={[typography.body, { color: colors.textPrimary, marginTop: 2 }]}>{beat.description}</Text>
                      <View style={{ marginTop: spacing.xxs }}>
                        <EvidenceBadge confidence={beat.confidence} evidenceCount={beat.evidenceCount} evidenceLabel="days that month" />
                      </View>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </GlassCard>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
