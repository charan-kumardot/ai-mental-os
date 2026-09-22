import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAuth } from '../src/lib/auth-context';
import { useProfile } from '../src/lib/profile-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { PressableRow } from '../src/components/PressableRow';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Ring } from '../src/components/Ring';
import { EvidenceSheet } from '../src/components/EvidenceSheet';
import { SkeletonCard } from '../src/components/Skeleton';
import { fetchTodayState, TodayState, buildRecoveryPlan } from '../src/lib/today';
import { fetchPersonalState, StateResult } from '../src/lib/stateEngine';
import { listInterventionResults, listCustomInterventions, computeAutopilotRanking, findIntervention } from '../src/lib/interventions';

const LOAD_LABEL: Record<string, string> = { low: 'Light', moderate: 'Moderate', high: 'Heavy' };
const LEVEL_SCORE: Record<string, number> = { low: 0, moderate: 1, high: 2 };

// Recovery Debt (spec §28) — a real comparative behavioral indicator, not
// a medical measurement (never phrased as one): load vs. recovery, both
// already computed from real signals by the state engine. Deliberately a
// coarse 3-state read (building/balanced/ahead) rather than a precise
// score, since the underlying inputs are themselves coarse.
function recoveryDebt(mentalLoad: string | null, recovery: string | null): 'building' | 'balanced' | 'ahead' | null {
  if (!mentalLoad || !recovery) return null;
  const loadScore = LEVEL_SCORE[mentalLoad];
  const recoveryScore = LEVEL_SCORE[recovery];
  const diff = loadScore - recoveryScore;
  if (diff >= 1) return 'building';
  if (diff <= -1) return 'ahead';
  return 'balanced';
}

const DEBT_COPY: Record<string, { label: string; detail: string }> = {
  building: { label: 'Building', detail: 'Load looks heavier than recovery today — worth protecting some downtime.' },
  balanced: { label: 'Balanced', detail: "Load and recovery look roughly matched today." },
  ahead: { label: 'Ahead', detail: 'Recovery looks strong relative to today\'s load.' },
};

export default function Today() {
  const { colors, spacing, typography } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const maximumPrivacy = profile?.privacyMode === 'maximum_privacy';
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<TodayState | null>(null);
  const [personalState, setPersonalState] = useState<StateResult | null>(null);
  const [topIntervention, setTopIntervention] = useState<{ title: string; helped: number; attempts: number } | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const interventionEvidenceRef = useRef<BottomSheetModal>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [today, results, customInterventions, baselineState] = await Promise.all([
        fetchTodayState(user.$id),
        listInterventionResults(user.$id),
        listCustomInterventions(user.$id),
        maximumPrivacy ? Promise.resolve(null) : fetchPersonalState().catch(() => null),
      ]);
      setState(today);
      setPersonalState(baselineState);
      const autopilot = computeAutopilotRanking(results);
      if (autopilot.ready) {
        const best = autopilot.ranked[0];
        const def = findIntervention(best.interventionId, customInterventions);
        if (def) setTopIntervention({ title: def.title, helped: best.helped, attempts: best.attempts });
      }
    } finally {
      setLoading(false);
    }
  }, [user, maximumPrivacy]);

  useEffect(() => {
    load();
  }, [load]);

  const labelFor = (deltaMinutes: number) => {
    const sign = deltaMinutes >= 0 ? '+' : '-';
    // Baselines are computed means, so deltaMinutes is rarely a whole
    // number — round once up front rather than leaking float remainder
    // digits (e.g. "45.428571428571445m") into the displayed label.
    const abs = Math.round(Math.abs(deltaMinutes));
    return `${sign}${Math.floor(abs / 60)}h ${abs % 60}m`;
  };

  // "Your sleep is 1h 20m below your normal range" — compares today's real
  // value against the user's own short-term baseline, never a population
  // average. Only renders when there's an actual baseline to compare
  // against (never a fabricated "normal").
  const vsNormalText = (dimension: 'sleepMinutes' | 'steps', unit: 'minutes' | 'count') => {
    const baseline = personalState?.baselines?.[dimension]?.short;
    const todayValue = personalState?.todayValues?.[dimension];
    if (!baseline || todayValue == null) return null;
    const diff = todayValue - baseline.mean;
    if (Math.abs(diff) < (unit === 'minutes' ? 15 : 500)) return 'about your normal';
    const direction = diff > 0 ? 'above' : 'below';
    const amount = unit === 'minutes' ? labelFor(Math.abs(diff)).replace('+', '') : `${Math.round(Math.abs(diff))}`;
    return `${amount} ${direction} your normal`;
  };

  const energyLevel = personalState?.state?.energy;
  const recoveryLevel = personalState?.state?.recovery;
  const stateLabel: Record<string, string> = { low: 'Below normal', moderate: 'Normal', high: 'Above normal' };
  const debt = recoveryDebt(personalState?.state?.mentalLoad ?? null, personalState?.state?.recovery ?? null);
  const recoveryPlan = buildRecoveryPlan(state?.freeWindowMinutes ?? null, debt, topIntervention);

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
        <ScreenHeader title="Your day" orbState={loading ? 'thinking' : state?.hasAnyData ? 'insight' : 'idle'} />

        {loading && (
          <View style={{ gap: spacing.md }}>
            <GlassCard>
              <SkeletonCard lines={2} />
            </GlassCard>
            <GlassCard>
              <SkeletonCard lines={1} />
            </GlassCard>
          </View>
        )}

        {!loading && maximumPrivacy && (
          <GlassCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Feather name="shield" size={16} color={colors.textPrimary} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Switched off by your privacy mode</Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Maximum privacy turns off anything that synthesizes across your connected sources — that includes
              Today's state. Switch back to Balanced in You → Privacy to turn it on again.
            </Text>
            <PressableRow onPress={() => router.push('/(tabs)/you')} style={{ gap: spacing.xs }}>
              <Feather name="link" size={14} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Go to Privacy settings</Text>
            </PressableRow>
          </GlassCard>
        )}

        {!loading && !maximumPrivacy && state && !state.hasAnyData && (
          <GlassCard>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Nothing to show yet today
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Connect Health Connect and Calendar to see real energy and recovery signals here — otherwise this
              stays honestly empty rather than guessing.
            </Text>
            <PressableRow onPress={() => router.push('/(tabs)/you')} style={{ gap: spacing.xs }}>
              <Feather name="link" size={14} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                Go to Connected sources
              </Text>
            </PressableRow>
          </GlassCard>
        )}

        {!loading && !maximumPrivacy && state && state.hasAnyData && (
          <>
            {/* Consolidated "today's state" surface — rings + the two derived
                reads that come from the same state estimate used to live as
                three separate identical-chrome cards in a row. */}
            <GlassCard tint="accent">
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.xs }}>
                <Ring
                  ratio={state.energy.ratio}
                  label="Energy"
                  value={energyLevel ? stateLabel[energyLevel] : state.energy.label}
                  color={colors.warning}
                />
                <Ring
                  ratio={state.focus.ratio}
                  label="Focus"
                  value={state.focus.label}
                  color={colors.textMuted}
                />
                <Ring
                  ratio={state.recovery.ratio}
                  label="Recovery"
                  value={recoveryLevel ? stateLabel[recoveryLevel] : state.recovery.label}
                  color={colors.primary}
                />
              </View>
              {(vsNormalText('steps', 'count') || vsNormalText('sleepMinutes', 'minutes')) && (
                <View style={{ marginTop: spacing.sm, gap: 2 }}>
                  {vsNormalText('steps', 'count') && (
                    <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
                      Steps: {vsNormalText('steps', 'count')} (last 7 days)
                    </Text>
                  )}
                  {vsNormalText('sleepMinutes', 'minutes') && (
                    <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
                      Sleep: {vsNormalText('sleepMinutes', 'minutes')} (last 7 days)
                    </Text>
                  )}
                </View>
              )}

              {(personalState?.state?.mentalLoad || recoveryDebt(personalState?.state?.mentalLoad ?? null, personalState?.state?.recovery ?? null)) && (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                  {personalState?.state?.mentalLoad && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Feather name="layers" size={13} color={colors.aiAccent} />
                        <Text style={[typography.micro, { color: colors.textSecondary }]}>Mental load</Text>
                      </View>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 2 }]}>
                        {LOAD_LABEL[personalState.state.mentalLoad]}
                      </Text>
                    </View>
                  )}
                  {(() => {
                    const debt = recoveryDebt(personalState?.state?.mentalLoad ?? null, personalState?.state?.recovery ?? null);
                    if (!debt) return null;
                    const copy = DEBT_COPY[debt];
                    const color = debt === 'building' ? colors.warning : debt === 'ahead' ? colors.success : colors.secondary;
                    return (
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Feather name="battery-charging" size={13} color={color} />
                          <Text style={[typography.micro, { color: colors.textSecondary }]}>Recovery debt</Text>
                        </View>
                        <Text style={[typography.bodyMedium, { color, marginTop: 2 }]}>{copy.label}</Text>
                      </View>
                    );
                  })()}
                </View>
              )}

              <Text style={[typography.micro, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
                Energy from steps, Recovery from sleep — Focus has no real source yet, so it stays honest rather
                than invented.
              </Text>
            </GlassCard>

            {personalState?.drifts && personalState.drifts.length > 0 && (
              <GlassCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <Feather name="trending-up" size={16} color={colors.warning} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Your normal has shifted</Text>
                </View>
                {personalState.drifts.map((d, i) => (
                  <Text key={i} style={[typography.caption, { color: colors.textSecondary }]}>
                    {d}
                  </Text>
                ))}
              </GlassCard>
            )}

            {state.delta && (
              <GlassCard>
                <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  What changed since yesterday
                </Text>
                {state.delta.sleepMinutesDelta != null && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Sleep</Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: state.delta.sleepMinutesDelta < 0 ? colors.warning : colors.secondary, fontWeight: '700' },
                      ]}
                    >
                      {state.delta.sleepMinutesDelta < 0 ? '↓ ' : '↑ '}
                      {labelFor(state.delta.sleepMinutesDelta).replace('-', '').replace('+', '')}
                    </Text>
                  </View>
                )}
                {state.delta.meetingCountDelta != null && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Meetings</Text>
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: state.delta.meetingCountDelta > 0 ? colors.warning : colors.secondary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {state.delta.meetingCountDelta >= 0 ? '↑ ' : '↓ '}
                      {Math.abs(state.delta.meetingCountDelta)}
                    </Text>
                  </View>
                )}
              </GlassCard>
            )}

            {personalState?.similarDays?.skipped === false && personalState.similarDays.simulation && (
              <GlassCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <Feather name="repeat" size={16} color={colors.aiAccent} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Days like this</Text>
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  You've had {personalState.similarDays.simulation.similarDayCount} similar day
                  {personalState.similarDays.simulation.similarDayCount === 1 ? '' : 's'} before (matched on{' '}
                  {personalState.similarDays.simulation.matchedOn.join(' and ')}).
                  {personalState.similarDays.simulation.averageMood != null &&
                    ` Mood on those days averaged ${personalState.similarDays.simulation.averageMood}/5.`}
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.xs }]}>
                  A real pattern from your own history — not a prediction for today.
                </Text>
              </GlassCard>
            )}

            {recoveryPlan && (
              <GlassCard tint="accent">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <Feather name="sunset" size={16} color={colors.warning} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Recovery planner</Text>
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{recoveryPlan}</Text>
              </GlassCard>
            )}

            {!(topIntervention && suggestionDismissed) && (
              <GlassCard>
                <PressableRow onPress={() => router.push('/interventions')} style={{ gap: spacing.sm }}>
                  <Feather name="zap" size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                      {topIntervention ? topIntervention.title : 'Try something small'}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      {topIntervention
                        ? `Helped you ${topIntervention.helped}/${topIntervention.attempts} times before`
                        : 'Short, low-effort things worth trying right now'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </PressableRow>
                {topIntervention && (
                  <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                    <PressableRow onPress={() => interventionEvidenceRef.current?.present()} style={{ gap: 4 }}>
                      <Feather name="help-circle" size={13} color={colors.primary} />
                      <Text style={[typography.micro, { color: colors.primary }]}>Why this?</Text>
                    </PressableRow>
                    {/* Spec §81's explicit dismiss action — a real "not now"
                        distinct from just navigating away. Hides this specific
                        suggestion for the rest of this screen visit only; it
                        isn't recorded as a rejected attempt (that would
                        incorrectly count toward the intervention's own
                        helped/attempts ranking, which only tracks real tries). */}
                    <PressableRow onPress={() => setSuggestionDismissed(true)} style={{ gap: 4 }}>
                      <Feather name="x" size={13} color={colors.textMuted} />
                      <Text style={[typography.micro, { color: colors.textMuted }]}>Not now</Text>
                    </PressableRow>
                  </View>
                )}
              </GlassCard>
            )}
          </>
        )}
      </ScrollView>

      <EvidenceSheet
        ref={interventionEvidenceRef}
        title={topIntervention?.title ?? ''}
        confidence={topIntervention ? topIntervention.helped / topIntervention.attempts : undefined}
        items={
          topIntervention
            ? [
                {
                  kind: 'observed',
                  text: `You rated this "Helped" ${topIntervention.helped} of ${topIntervention.attempts} times you tried it.`,
                },
                {
                  kind: 'pattern',
                  text: 'Ranked ahead of your other interventions because it has both the highest success rate and at least 2 real attempts — a single lucky try isn\'t enough to rank on its own.',
                },
              ]
            : []
        }
      />
    </ScreenBackground>
  );
}
