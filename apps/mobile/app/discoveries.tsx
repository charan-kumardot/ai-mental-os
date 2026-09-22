import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAuth } from '../src/lib/auth-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { DiscoveryCard } from '../src/components/DiscoveryCard';
import { DiscoveryReveal } from '../src/components/DiscoveryReveal';
import { fetchPatterns, Pattern } from '../src/lib/patterns';
import { databases, DB_ID, COLLECTIONS, Query } from '../src/lib/appwrite';
import { staggerEntering } from '../src/lib/entrance';

const DIMENSION_DISPLAY: Record<string, string> = {
  mood: 'mood',
  sleepMinutes: 'sleep',
  steps: 'steps',
  meetingCount: 'meeting count',
  meetingMinutes: 'meeting load',
};

function patternTitle(p: Pattern) {
  const a = DIMENSION_DISPLAY[p.dimensionA] ?? p.dimensionA;
  const b = DIMENSION_DISPLAY[p.dimensionB] ?? p.dimensionB;
  return `${a} ↔ ${b}`;
}

/**
 * Personal Blind Spots (spec §27) — a real heuristic layered onto
 * already-detected patterns, never a new inference: flags a relationship
 * that runs counter to the common assumption (movement usually assumed to
 * help mood; meetings usually assumed to drain it). Only ever fires on a
 * pattern that was already found with real evidence — nothing invented.
 */
function isBlindSpot(p: Pattern): boolean {
  const pair = [p.dimensionA, p.dimensionB].sort().join('|');
  if (pair === 'mood|steps' && p.relationshipType === 'negative') return true;
  if (pair === 'meetingCount|mood' && p.relationshipType === 'positive') return true;
  return false;
}

/**
 * Spec §24-26 — Personal Discoveries, "You were right," "You may have been
 * wrong," combined into one screen since all three share the same
 * DiscoveryCard shape and the same underlying evidence sources (already-
 * detected patterns, already-concluded experiments). Nothing here is
 * computed fresh — this only presents what the pattern-detection and
 * experiment engines already found, with cinematic framing instead of a
 * plain list.
 */
export default function Discoveries() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [justDiscovered, setJustDiscovered] = useState<Pattern | null>(null);
  const [otherPatterns, setOtherPatterns] = useState<Pattern[]>([]);
  const [weakened, setWeakened] = useState<Pattern[]>([]);
  const [confirmedExperiments, setConfirmedExperiments] = useState<any[]>([]);
  const [unconfirmedExperiments, setUnconfirmedExperiments] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [patternsRes, experimentsRes] = await Promise.all([
        fetchPatterns(),
        databases.listDocuments(DB_ID, COLLECTIONS.experiments, [
          Query.equal('userId', user.$id),
          Query.equal('status', 'completed'),
          Query.orderDesc('$createdAt'),
          Query.limit(20),
        ]),
      ]);

      const allPatterns = patternsRes.patterns ?? [];
      const justId = patternsRes.justDiscoveredId ?? null;
      setJustDiscovered(justId ? allPatterns.find((p) => p.id === justId) ?? null : null);
      setOtherPatterns(justId ? allPatterns.filter((p) => p.id !== justId) : allPatterns);
      setWeakened(patternsRes.weakened ?? []);

      const confirmed = experimentsRes.documents.filter((e) => e.conclusion?.startsWith('Confirmed'));
      const unconfirmed = experimentsRes.documents.filter((e) => e.conclusion?.startsWith('Not confirmed'));
      setConfirmedExperiments(confirmed);
      setUnconfirmedExperiments(unconfirmed);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const hasAnything =
    justDiscovered || otherPatterns.length > 0 || weakened.length > 0 || confirmedExperiments.length > 0 || unconfirmedExperiments.length > 0;

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Discoveries" orbState={loading ? 'thinking' : justDiscovered ? 'insight' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          What's actually been found in your own history — new patterns, confirmed hunches, and beliefs worth
          reconsidering.
        </Text>

        {!loading && !hasAnything && (
          <GlassCard>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
              Nothing to show yet — this fills in as real patterns emerge and experiments conclude.
            </Text>
          </GlassCard>
        )}

        {justDiscovered && (
          <DiscoveryReveal
            title={patternTitle(justDiscovered)}
            body={justDiscovered.description}
            confidence={justDiscovered.confidence}
            evidenceCount={justDiscovered.evidenceCount}
          />
        )}

        {confirmedExperiments.map((e, i) => (
          <Animated.View key={e.$id} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
            <DiscoveryCard kind="confirmed_hypothesis" title={e.hypothesis} body={e.conclusion} confidence={e.confidence} />
          </Animated.View>
        ))}

        {weakened.map((p, i) => (
          <Animated.View key={p.id} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
            <DiscoveryCard
              kind="contradicted"
              title={patternTitle(p)}
              body="This used to look like a real pattern, but your recent history doesn't support it as strongly anymore. Still being watched — not thrown out yet."
              confidence={p.confidence}
              evidenceCount={p.evidenceCount}
            />
          </Animated.View>
        ))}

        {unconfirmedExperiments.map((e, i) => (
          <Animated.View key={e.$id} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
            <DiscoveryCard kind="unconfirmed_hypothesis" title={e.hypothesis} body={e.conclusion} confidence={e.confidence} />
          </Animated.View>
        ))}

        {otherPatterns.map((p, i) => (
          <Animated.View key={p.id} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
            {isBlindSpot(p) ? (
              <DiscoveryCard kind="blind_spot" title={patternTitle(p)} body={p.description} confidence={p.confidence} evidenceCount={p.evidenceCount} />
            ) : (
              <DiscoveryCard kind="discovery" title={patternTitle(p)} body={p.description} confidence={p.confidence} evidenceCount={p.evidenceCount} />
            )}
          </Animated.View>
        ))}
      </ScrollView>
    </ScreenBackground>
  );
}
