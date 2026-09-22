import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/lib/auth-context';
import { databases, DB_ID, COLLECTIONS, ID, Query, Permission, Role } from '../../src/lib/appwrite';
import { GlassCard } from '../../src/components/GlassCard';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { ExperimentCard } from '../../src/components/ExperimentCard';
import { PressableRow } from '../../src/components/PressableRow';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { AIOrb } from '../../src/components/AIOrb';
import { fetchPatterns, Pattern } from '../../src/lib/patterns';
import { logExperimentObservations } from '../../src/lib/experimentObservations';
import { recordMemory } from '../../src/lib/memory';

const DIMENSION_OPTIONS: { key: string; label: string }[] = [
  { key: 'mood', label: 'Mood' },
  { key: 'sleepMinutes', label: 'Sleep' },
  { key: 'steps', label: 'Steps' },
  { key: 'meetingCount', label: 'Meetings' },
];

const DIMENSION_DISPLAY: Record<string, string> = {
  mood: 'mood',
  sleepMinutes: 'sleep',
  steps: 'steps',
  meetingCount: 'meeting count',
  meetingMinutes: 'meeting load',
};

export default function Experiments() {
  const { colors, spacing, typography } = useTheme();
  const { user } = useAuth();
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hypothesis, setHypothesis] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [concludingId, setConcludingId] = useState<string | null>(null);
  const [conclusionText, setConclusionText] = useState('');
  const [concluding, setConcluding] = useState(false);
  const [measuredDimensions, setMeasuredDimensions] = useState<string[]>(['mood']);
  const [suggestedPattern, setSuggestedPattern] = useState<Pattern | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.experiments, [
        Query.equal('userId', user.$id),
        Query.orderDesc('$createdAt'),
      ]);
      setExperiments(res.documents);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Automatic Experiment Discovery (spec §27) — a real detected pattern
  // (never a generic prompt) is the only thing that ever triggers a
  // suggestion here; cached-only fetch so this never bills an AI call
  // just to render the tab.
  useEffect(() => {
    fetchPatterns()
      .then((result) => setSuggestedPattern(result.patterns?.[0] ?? null))
      .catch(() => setSuggestedPattern(null));
  }, []);

  const toggleDimension = (key: string) => {
    setMeasuredDimensions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const acceptSuggestion = () => {
    if (!suggestedPattern) return;
    setHypothesis(
      `Does deliberately changing ${DIMENSION_DISPLAY[suggestedPattern.dimensionA] ?? suggestedPattern.dimensionA} affect ${DIMENSION_DISPLAY[suggestedPattern.dimensionB] ?? suggestedPattern.dimensionB}?`
    );
    setMeasuredDimensions([suggestedPattern.dimensionA, suggestedPattern.dimensionB].filter((d) => DIMENSION_OPTIONS.some((o) => o.key === d)));
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!user || !hypothesis.trim()) return;
    setCreating(true);
    try {
      await databases.createDocument(
        DB_ID,
        COLLECTIONS.experiments,
        ID.unique(),
        {
          userId: user.$id,
          hypothesis: hypothesis.trim(),
          status: 'active',
          startedAt: new Date().toISOString(),
          measuredDimensions: measuredDimensions.length ? measuredDimensions : undefined,
        },
        [Permission.read(Role.user(user.$id)), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id))]
      );
      setHypothesis('');
      setMeasuredDimensions(['mood']);
      setSuggestedPattern(null);
      setShowForm(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleConclude = async (outcome: 'confirmed' | 'not_confirmed' | 'inconclusive') => {
    if (!concludingId) return;
    setConcluding(true);
    try {
      const confidence = outcome === 'inconclusive' ? 0.3 : 0.6;
      const prefix =
        outcome === 'confirmed' ? 'Confirmed: ' : outcome === 'not_confirmed' ? 'Not confirmed: ' : 'Inconclusive: ';
      const finalConclusion = prefix + (conclusionText.trim() || 'No additional notes.');
      // A distinct haptic per real outcome, not one generic "tapped a button"
      // buzz for every action — confirmed is a genuine win, not-confirmed is
      // still useful information (warning tone, not a failure buzz).
      Haptics.notificationAsync(
        outcome === 'confirmed' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      ).catch(() => {});
      await databases.updateDocument(DB_ID, COLLECTIONS.experiments, concludingId, {
        status: 'completed',
        conclusion: finalConclusion,
        confidence,
        endedAt: new Date().toISOString(),
      });
      // Structured N-of-1 phases (spec §26) — backfill real baseline vs.
      // intervention observations from the user's own records now that an
      // end date exists to measure against. Best-effort: a failure here
      // shouldn't block the conclusion itself.
      logExperimentObservations(concludingId).catch(() => {});
      recordMemory({ type: 'experiment', content: finalConclusion, source: 'experiments_screen' }).catch(() => {});
      setConcludingId(null);
      setConclusionText('');
      await load();
    } finally {
      setConcluding(false);
    }
  };

  const handleAbandon = async (id: string) => {
    await databases.updateDocument(DB_ID, COLLECTIONS.experiments, id, {
      status: 'abandoned',
      endedAt: new Date().toISOString(),
    });
    await load();
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={[typography.display, { color: colors.textPrimary }]}>Experiments</Text>
          <AIOrb size={16} state={loading ? 'thinking' : suggestedPattern ? 'insight' : 'idle'} />
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Test a personal hypothesis against your own evidence — not a claim about anyone else.
        </Text>

        {!showForm && suggestedPattern && (
          <GlassCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
              <Feather name="compass" size={16} color={colors.aiAccent} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Worth testing?</Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              {suggestedPattern.description}
            </Text>
            <SecondaryButton label="Set up this experiment" onPress={acceptSuggestion} />
          </GlassCard>
        )}

        {showForm ? (
          <GlassCard>
            <TextField
              label="What do you want to test?"
              placeholder="e.g. Does a meeting-free morning improve afternoon focus?"
              value={hypothesis}
              onChangeText={setHypothesis}
              multiline
            />
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm }]}>
              What should I measure while this runs?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
              {DIMENSION_OPTIONS.map((opt) => {
                const active = measuredDimensions.includes(opt.key);
                return (
                  <PressableRow key={opt.key} onPress={() => toggleDimension(opt.key)}>
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: active ? colors.surface : colors.textPrimary,
                          backgroundColor: active ? colors.primary : colors.primarySoft,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 6,
                          borderRadius: 14,
                          overflow: 'hidden',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </PressableRow>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <PrimaryButton
                label="Start experiment"
                onPress={handleCreate}
                loading={creating}
                disabled={!hypothesis.trim()}
                style={{ flex: 1 }}
              />
              <SecondaryButton label="Cancel" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        ) : (
          <PrimaryButton label="Propose an experiment" onPress={() => setShowForm(true)} />
        )}

        {experiments.length === 0 ? (
          <GlassCard>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
              No experiments yet. As you check in more, I'll also suggest experiments based on patterns I notice.
            </Text>
          </GlassCard>
        ) : (
          experiments.map((exp) => (
            <ExperimentCard key={exp.$id} hypothesis={exp.hypothesis} status={exp.status} conclusion={exp.conclusion}>
              {(exp.status === 'active' || exp.status === 'proposed') &&
                (concludingId === exp.$id ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <TextField
                      placeholder="What did you notice? (optional)"
                      value={conclusionText}
                      onChangeText={setConclusionText}
                      multiline
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                      <PrimaryButton
                        label="Confirmed"
                        onPress={() => handleConclude('confirmed')}
                        loading={concluding}
                        style={{ flex: 1 }}
                      />
                      <SecondaryButton
                        label="Not confirmed"
                        onPress={() => handleConclude('not_confirmed')}
                        loading={concluding}
                        style={{ flex: 1 }}
                      />
                    </View>
                    <SecondaryButton
                      label="Inconclusive"
                      onPress={() => handleConclude('inconclusive')}
                      loading={concluding}
                      style={{ marginTop: spacing.xs }}
                    />
                    <Text
                      style={[typography.micro, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}
                      onPress={() => setConcludingId(null)}
                    >
                      Cancel
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    <SecondaryButton label="Conclude" onPress={() => setConcludingId(exp.$id)} style={{ flex: 1 }} />
                    <SecondaryButton label="Abandon" onPress={() => handleAbandon(exp.$id)} style={{ flex: 1 }} />
                  </View>
                ))}
            </ExperimentCard>
          ))
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
