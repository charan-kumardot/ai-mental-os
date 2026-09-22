import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/lib/auth-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { TextField } from '../src/components/TextField';
import { PressableRow } from '../src/components/PressableRow';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { AIOrb } from '../src/components/AIOrb';
import { InterventionCard } from '../src/components/InterventionCard';
import {
  STATIC_INTERVENTIONS,
  TYPE_LABEL,
  InterventionType,
  InterventionDef,
  InterventionFeedback,
  listCustomInterventions,
  createCustomIntervention,
  startIntervention,
  completeIntervention,
  abandonIntervention,
  listInterventionResults,
  computeAutopilotRanking,
  findIntervention,
} from '../src/lib/interventions';
import { Playbook, listPlaybooks, createPlaybook, deletePlaybook } from '../src/lib/playbooks';
import { recordMemory } from '../src/lib/memory';
import { compileIntervention, CompiledRoutineResult } from '../src/lib/interventionCompiler';

const TYPE_ICON: Record<InterventionType, keyof typeof Feather.glyphMap> = {
  breathing: 'wind',
  movement: 'activity',
  sensory: 'droplet',
  cognitive: 'edit-3',
  social: 'message-circle',
  rest: 'coffee',
};

const FEEDBACK_OPTIONS: { value: InterventionFeedback; label: string }[] = [
  { value: 'helped', label: 'Helped' },
  { value: 'no_effect', label: 'No real effect' },
  { value: 'made_worse', label: 'Made it worse' },
  { value: 'not_completed', label: "Didn't finish" },
];

type Screen = 'browse' | 'active' | 'feedback' | 'save_playbook';

export default function Interventions() {
  const { colors, spacing, typography } = useTheme();
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>('browse');
  const [customs, setCustoms] = useState<InterventionDef[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [active, setActive] = useState<{ def: InterventionDef; resultId: string } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<InterventionType>('cognitive');
  const [addingCustom, setAddingCustom] = useState(false);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbookTrigger, setPlaybookTrigger] = useState('');
  const [compiling, setCompiling] = useState(false);
  const [compiledRoutine, setCompiledRoutine] = useState<CompiledRoutineResult | null>(null);

  const handleCompile = async (minutes: number) => {
    setCompiling(true);
    setCompiledRoutine(null);
    try {
      const result = await compileIntervention(minutes);
      setCompiledRoutine(result);
    } finally {
      setCompiling(false);
    }
  };
  const [savingPlaybook, setSavingPlaybook] = useState(false);
  const [justHelped, setJustHelped] = useState<InterventionDef | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [c, r, p] = await Promise.all([listCustomInterventions(user.$id), listInterventionResults(user.$id), listPlaybooks(user.$id)]);
    setCustoms(c);
    setResults(r);
    setPlaybooks(p);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const allInterventions = [...STATIC_INTERVENTIONS, ...customs];
  const autopilot = computeAutopilotRanking(results);

  const handleTry = async (def: InterventionDef) => {
    if (!user) return;
    const contextSnapshot = JSON.stringify({ hour: new Date().getHours() });
    const doc = await startIntervention(user.$id, def.id, contextSnapshot);
    setActive({ def, resultId: doc.$id });
    setScreen('active');
  };

  const handleCancelActive = async () => {
    if (active) await abandonIntervention(active.resultId);
    setActive(null);
    setScreen('browse');
  };

  const handleFinishActive = () => {
    setScreen('feedback');
  };

  const handleSubmitFeedback = async (feedback: InterventionFeedback) => {
    if (!active) return;
    setSubmitting(true);
    try {
      await completeIntervention(active.resultId, feedback, note.trim() || undefined);
      if (feedback === 'helped') {
        recordMemory({ type: 'intervention', content: `${active.def.title} helped`, source: 'interventions_screen' }).catch(() => {});
      }
      setNote('');
      if (feedback === 'helped') {
        // Personal Playbooks (spec §38) — offer to turn a technique that
        // just genuinely helped into a "when X, do Y" recipe, rather than
        // asking the user to write one from a blank page.
        setJustHelped(active.def);
        setActive(null);
        setScreen('save_playbook');
      } else {
        setActive(null);
        setScreen('browse');
      }
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePlaybook = async () => {
    if (!user || !justHelped || !playbookTrigger.trim()) return;
    setSavingPlaybook(true);
    try {
      await createPlaybook(user.$id, playbookTrigger.trim(), [justHelped.title]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPlaybookTrigger('');
      setJustHelped(null);
      setScreen('browse');
      await load();
    } finally {
      setSavingPlaybook(false);
    }
  };

  const handleSkipPlaybook = () => {
    setPlaybookTrigger('');
    setJustHelped(null);
    setScreen('browse');
  };

  const handleDeletePlaybook = async (playbookId: string) => {
    await deletePlaybook(playbookId);
    await load();
  };

  const handleAddCustom = async () => {
    if (!user || !newTitle.trim()) return;
    setAddingCustom(true);
    try {
      await createCustomIntervention(user.$id, {
        type: newType,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setShowAddForm(false);
      await load();
    } finally {
      setAddingCustom(false);
    }
  };

  if (screen === 'active' && active) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <AIOrb state="listening" size={64} />
          <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            {active.def.title}
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center', maxWidth: 300 },
            ]}
          >
            {active.def.description}
          </Text>
          {active.def.durationMinutes > 0 && (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              About {active.def.durationMinutes} minute{active.def.durationMinutes === 1 ? '' : 's'}
            </Text>
          )}
          <PrimaryButton label="I'm done" onPress={handleFinishActive} style={{ marginTop: spacing.xl, width: 220 }} />
          <SecondaryButton
            label="Cancel"
            onPress={handleCancelActive}
            style={{ marginTop: spacing.sm, width: 220 }}
          />
        </View>
      </ScreenBackground>
    );
  }

  if (screen === 'feedback' && active) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
          <AIOrb state="uncertainty" size={56} />
          <Text style={[typography.title, { color: colors.textPrimary, textAlign: 'center' }]}>How did that feel?</Text>
          <View style={{ width: '100%', gap: spacing.sm }}>
            {FEEDBACK_OPTIONS.map((opt) => (
              <SecondaryButton
                key={opt.value}
                label={opt.label}
                onPress={() => handleSubmitFeedback(opt.value)}
                disabled={submitting}
              />
            ))}
          </View>
          <TextField
            placeholder="Anything worth remembering about that? (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            style={{ minHeight: 60, width: '100%' }}
          />
        </View>
      </ScreenBackground>
    );
  }

  if (screen === 'save_playbook' && justHelped) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
          <AIOrb state="learning" size={56} />
          <Text style={[typography.title, { color: colors.textPrimary, textAlign: 'center' }]}>
            Save this as a playbook?
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', maxWidth: 300 }]}
          >
            "{justHelped.title}" just helped. Next time this happens, I can remind you it's worked before.
          </Text>
          {/* Explicit width:'100%' wrapper — this screen's parent uses
              alignItems:'center' with no preceding full-width sibling, so a
              width:'100%' child alone resolves against an ambiguous
              shrink-to-fit ancestor instead of the actual screen width
              (confirmed on-device: text rendered edge-to-edge, unclipped).
              A definite-width wrapper gives Yoga an unambiguous parent to
              resolve against. */}
          <View style={{ width: '100%' }}>
            <TextField
              placeholder="When does this apply? e.g. when I feel overwhelmed at work"
              value={playbookTrigger}
              onChangeText={setPlaybookTrigger}
              multiline
              style={{ minHeight: 60 }}
            />
            <PrimaryButton
              label="Save playbook"
              onPress={handleSavePlaybook}
              loading={savingPlaybook}
              disabled={!playbookTrigger.trim()}
            />
            <SecondaryButton label="Not now" onPress={handleSkipPlaybook} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
        <ScreenHeader title="Try something" />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Short, low-effort things some people find helpful. What actually helps you is learned from your own
          feedback below — not assumed up front.
        </Text>

        <GlassCard>
          <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            What's worked for you
          </Text>
          {autopilot.ready ? (
            <View style={{ gap: spacing.sm }}>
              {autopilot.ranked.slice(0, 3).map((entry) => {
                const def = findIntervention(entry.interventionId, customs);
                if (!def) return null;
                return (
                  <View key={entry.interventionId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Feather name={TYPE_ICON[def.type]} size={16} color={colors.success} />
                    <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{def.title}</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      Helped {entry.helped}/{entry.attempts}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Still learning what helps you — try a few things and rate how they went, and I'll start noticing
              patterns.
            </Text>
          )}
        </GlassCard>

        <GlassCard tint="accent">
          <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Compile me a routine
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            A tiny sequence built only from what's actually helped you before — how much time do you have?
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {[5, 10, 15, 20].map((mins) => (
              <SecondaryButton
                key={mins}
                label={`${mins} min`}
                onPress={() => handleCompile(mins)}
                loading={compiling}
                style={{ flex: 1, minWidth: 70 }}
              />
            ))}
          </View>
          {compiledRoutine?.skipped === false && compiledRoutine.routine && (
            <View style={{ marginTop: spacing.xs }}>
              <Text style={[typography.insightQuote, { color: colors.textPrimary }]}>{compiledRoutine.routine.text}</Text>
              <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.sm }]}>
                Based on: {compiledRoutine.routine.basedOn.join(', ')}
              </Text>
            </View>
          )}
          {compiledRoutine?.skipped && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {compiledRoutine.message}
            </Text>
          )}
        </GlassCard>

        {playbooks.length > 0 && (
          <GlassCard>
            <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Your playbooks
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Recipes built from what's actually worked for you before.
            </Text>
            <View style={{ gap: spacing.sm }}>
              {playbooks.map((pb) => (
                <View key={pb.$id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <Feather name="book-open" size={16} color={colors.aiAccent} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{pb.trigger}</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {pb.steps.join(', ')}
                    </Text>
                  </View>
                  <Feather
                    name="trash-2"
                    size={14}
                    color={colors.textMuted}
                    onPress={() => handleDeletePlaybook(pb.$id)}
                  />
                </View>
              ))}
            </View>
          </GlassCard>
        )}

        {allInterventions.map((def) => (
          <InterventionCard
            key={def.id}
            icon={TYPE_ICON[def.type]}
            title={def.title}
            description={def.description}
            meta={`${TYPE_LABEL[def.type]}${def.durationMinutes > 0 ? ` · ~${def.durationMinutes} min` : ''}${def.custom ? ' · your own' : ''}`}
            onPress={() => handleTry(def)}
          />
        ))}

        {showAddForm ? (
          <GlassCard>
            <TextField label="What is it?" value={newTitle} onChangeText={setNewTitle} />
            <TextField label="Details (optional)" value={newDescription} onChangeText={setNewDescription} multiline />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
              {(Object.keys(TYPE_LABEL) as InterventionType[]).map((t) => (
                <PressableRow key={t} onPress={() => setNewType(t)} style={{ marginRight: spacing.xs }}>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: newType === t ? colors.surface : colors.textPrimary,
                        backgroundColor: newType === t ? colors.primary : colors.primarySoft,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 4,
                        borderRadius: 12,
                        overflow: 'hidden',
                      },
                    ]}
                  >
                    {TYPE_LABEL[t]}
                  </Text>
                </PressableRow>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <PrimaryButton
                label="Save"
                onPress={handleAddCustom}
                loading={addingCustom}
                disabled={!newTitle.trim()}
                style={{ flex: 1 }}
              />
              <SecondaryButton label="Cancel" onPress={() => setShowAddForm(false)} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        ) : (
          <SecondaryButton label="Add your own" onPress={() => setShowAddForm(true)} />
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
