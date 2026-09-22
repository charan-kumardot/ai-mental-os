import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/lib/auth-context';
import { databases, functions, DB_ID, COLLECTIONS, Query } from '../../src/lib/appwrite';
import { GlassCard } from '../../src/components/GlassCard';
import { AIOrb } from '../../src/components/AIOrb';
import { InsightCard } from '../../src/components/InsightCard';
import { PatternCard } from '../../src/components/PatternCard';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { PressableRow } from '../../src/components/PressableRow';
import { fetchPatterns, Pattern } from '../../src/lib/patterns';
import { fetchOpportunityWindow, OpportunityWindowResult } from '../../src/lib/opportunityWindow';

const { width } = Dimensions.get('window');

export default function Insights() {
  const { colors, spacing, radius, typography } = useTheme();
  const { user } = useAuth();
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [opportunity, setOpportunity] = useState<OpportunityWindowResult['window'] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.insights, [
        Query.equal('userId', user.$id),
        Query.orderDesc('$createdAt'),
        Query.limit(20),
      ]);
      setInsights(res.documents);

      // Ask the backend whether there's anything new worth surfacing.
      // Cheap rule-based checks run first server-side — this only ever
      // reaches an LLM call when there's a real, grounded deviation.
      try {
        const execution = await functions.createExecution('generate-insight', '', false);
        const body = JSON.parse(execution.responseBody || '{}');
        if (body.skipped) {
          setStatus(body.message);
        } else if (body.insight) {
          setStatus(null);
          setInsights((prev) => [body.insight, ...prev.filter((p) => p.$id !== body.insight.$id)]);
        } else if (body.error) {
          setStatus(null);
        }
      } catch {
        // Backend check is best-effort — the screen still works from
        // whatever's already stored if this fails (offline, cold function, etc).
        setStatus(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Same cached, already-computed pattern data shown on the Brain tab's
  // relationship map — surfaced here too so an empty `insights` collection
  // doesn't leave a genuinely dead screen when real patterns do exist.
  useEffect(() => {
    fetchPatterns()
      .then((r) => setPatterns(r.patterns ?? []))
      .catch(() => setPatterns([]));
  }, []);

  // Opportunity Window (spec §35) — deterministic, no AI call; only ever
  // set when there's a real, meaningful time-of-day gap in mood.
  useEffect(() => {
    fetchOpportunityWindow()
      .then((r) => setOpportunity(r.skipped ? null : r.window ?? null))
      .catch(() => setOpportunity(null));
  }, []);

  const cardWidth = width - 48; // matches screen horizontal padding (spacing.lg * 2)
  const onDeckScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12)));
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={[typography.display, { color: colors.textPrimary, flex: 1 }]}>Insights</Text>
          <AIOrb size={16} state={loading ? 'thinking' : insights.length > 0 ? 'insight' : 'idle'} />
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          What's actually changed, grounded in your own history — never a metrics dump.
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <PressableRow onPress={() => router.push('/recovery-radar')} style={{ flex: 1 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.pill,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
              }}
            >
              <Feather name="activity" size={14} color={colors.success} />
              <Text style={[typography.caption, { color: colors.textPrimary }]}>Recovery</Text>
            </View>
          </PressableRow>
          <PressableRow onPress={() => router.push('/weekly-review')} style={{ flex: 1 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.pill,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
              }}
            >
              <Feather name="calendar" size={14} color={colors.secondary} />
              <Text style={[typography.caption, { color: colors.textPrimary }]}>Your week</Text>
            </View>
          </PressableRow>
        </View>

        {insights.length === 0 ? (
          <GlassCard tint="accent">
            <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
              <AIOrb size={52} state="idle" />
              <Text style={[typography.insightQuote, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
                "{status ?? "Nothing notable to flag yet — I'll say something the moment your data actually shows a real change."}"
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg }}>
                <Feather name="info" size={13} color={colors.textMuted} />
                <Text style={[typography.micro, { color: colors.textMuted, textAlign: 'center' }]}>
                  Grounded in your check-ins and patterns only — never invented
                </Text>
              </View>
            </View>
          </GlassCard>
        ) : (
          <View>
            <ScrollView
              horizontal
              pagingEnabled={false}
              snapToInterval={cardWidth + 12}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onDeckScrollEnd}
              contentContainerStyle={{ gap: 12 }}
            >
              {insights.map((ins) => (
                <InsightCard
                  key={ins.$id}
                  title={ins.title}
                  body={ins.body}
                  confidence={typeof ins.confidence === 'number' ? ins.confidence : undefined}
                  style={{ width: cardWidth }}
                />
              ))}
            </ScrollView>
            {insights.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
                {insights.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === page ? 16 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i === page ? colors.primary : colors.border,
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {opportunity && (
          <GlassCard tint="primary">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
              <Feather name="sun" size={16} color={colors.success} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Your opportunity window</Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Your mood has been strongest during the {opportunity.bestLabel} ({opportunity.bestAvg}/5 avg over{' '}
              {opportunity.bestCount} check-ins) — noticeably higher than the {opportunity.worstLabel} (
              {opportunity.worstAvg}/5). This may be a good window to protect for what matters most.
            </Text>
          </GlassCard>
        )}

        {patterns.length > 0 && (
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs }]}>
              Also noticed
            </Text>
            {patterns.map((p) => (
              <PatternCard key={p.id} description={p.description} relationshipType={p.relationshipType} style={{ marginBottom: spacing.xs }} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
