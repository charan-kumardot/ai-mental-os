import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { staggerEntering } from '../src/lib/entrance';
import { useAuth } from '../src/lib/auth-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { TextField } from '../src/components/TextField';
import { AIOrb, OrbState } from '../src/components/AIOrb';
import { startIntervention, completeIntervention, InterventionFeedback } from '../src/lib/interventions';
import { submitToMentalInbox } from '../src/lib/mentalInbox';

type StepKind = 'intervention' | 'text' | 'choice' | 'info';

interface FlowStep {
  kind: StepKind;
  title: string;
  body?: string;
  interventionId?: string;
  placeholder?: string;
  choices?: string[];
}

interface FlowDef {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  intro: string;
  steps: FlowStep[];
}

// Every "intervention" step reuses a real, already-tracked technique from
// src/lib/interventions.ts (Personal Intervention Intelligence) rather than
// inventing parallel content — the attempt gets recorded and its feedback
// contributes to the same autopilot ranking used everywhere else in the
// app. Every "text" step submits through submitToMentalInbox, which means
// it passes through the real safety engine (process-mental-inbox/safety.js)
// and the real AI categorization — no separate, ungated free-text path.
const FLOWS: FlowDef[] = [
  {
    key: 'panic',
    label: 'Panic or anxious',
    icon: 'wind',
    intro: "Let's slow this down together, one step at a time.",
    steps: [
      {
        kind: 'intervention',
        interventionId: 'grounding-54321',
        title: 'Ground yourself',
        body: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.',
      },
      {
        kind: 'intervention',
        interventionId: 'box-breathing',
        title: 'Breathe',
        body: 'Inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat four times.',
      },
      { kind: 'choice', title: 'How do you feel now?', choices: ['Better', 'About the same', 'Worse'] },
    ],
  },
  {
    key: 'overthinking',
    label: 'Overthinking',
    icon: 'repeat',
    intro: "Let's untangle it rather than keep turning it over.",
    steps: [
      { kind: 'text', title: "Get it out of your head", placeholder: "What's going through your mind?" },
      { kind: 'text', title: 'What do you actually know?', placeholder: 'The facts, not the assumptions…' },
      { kind: 'text', title: "What are you assuming, not certain of?", placeholder: 'The uncertain part…' },
      {
        kind: 'text',
        title: 'One small thing you could do about the part you can control',
        placeholder: 'Smallest next step…',
      },
      { kind: 'choice', title: 'Did that help sort things out?', choices: ['Yes', 'A little', 'Not really'] },
    ],
  },
  {
    key: 'anger',
    label: 'Anger',
    icon: 'alert-circle',
    intro: "Let's pause before anything gets said that's hard to take back.",
    steps: [
      {
        kind: 'intervention',
        interventionId: 'physiological-sigh',
        title: 'Pause and regulate',
        body: 'Two quick inhales through the nose, then one long, slow exhale through the mouth. Repeat 3-5 times.',
      },
      { kind: 'text', title: 'What triggered this?', placeholder: 'What happened…' },
      {
        kind: 'text',
        title: "If you want to say something, write it here — you decide whether to send it once you've cooled down",
        placeholder: 'Draft (not sent anywhere)…',
      },
      { kind: 'choice', title: 'How do you feel now?', choices: ['Calmer', 'About the same', 'Still angry'] },
    ],
  },
  {
    key: 'overload',
    label: 'Overload',
    icon: 'layers',
    intro: "Let's get it out of your head and find one place to start.",
    steps: [
      {
        kind: 'text',
        title: "Get it all out — tasks, decisions, worries, whatever's stacking up",
        placeholder: "Everything on your plate…",
      },
      {
        kind: 'text',
        title: 'Of everything you just listed, what\'s the ONE thing you could do right now?',
        placeholder: 'One immediate next step…',
      },
      { kind: 'choice', title: 'Does that feel more manageable?', choices: ['Yes', 'A little', 'Not really'] },
    ],
  },
  {
    key: 'crash',
    label: 'Emotional crash',
    icon: 'cloud-rain',
    intro: "That sounds really hard.",
    steps: [
      {
        kind: 'info',
        title: "You don't have to explain or fix anything right now",
        body: "Let's just slow things down for a moment.",
      },
      {
        kind: 'intervention',
        interventionId: 'cold-water',
        title: 'A small physical reset',
        body: 'Cold water on your face or wrists, if that\'s available to you right now.',
      },
      {
        kind: 'text',
        title: 'Is there someone you trust who could know you\'re having a hard time?',
        placeholder: 'Who comes to mind… (optional)',
      },
      {
        kind: 'choice',
        title: 'What would help most right now?',
        choices: ['Being alone for a bit', 'Reaching out to someone', 'Talking to me more'],
      },
    ],
  },
];

const CHOICE_FEEDBACK: Record<string, InterventionFeedback> = {
  Better: 'helped',
  Yes: 'helped',
  Calmer: 'helped',
  'About the same': 'no_effect',
  'A little': 'no_effect',
  'Still angry': 'no_effect',
  'Not really': 'no_effect',
  Worse: 'made_worse',
};

export default function EmotionalFirstAid() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ flow?: string }>();
  const [flow, setFlow] = useState<FlowDef | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [textValue, setTextValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [safetyResponse, setSafetyResponse] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const activeResultIds = useRef<string[]>([]);

  const startFlow = (f: FlowDef) => {
    setFlow(f);
    setStepIndex(0);
    setTextValue('');
    activeResultIds.current = [];
  };

  // Deep-link support (e.g. from the Anti-Rumination Engine's "Take one
  // action" prompt) — jumps straight into a specific flow instead of
  // making the user pick it again from the chooser.
  useEffect(() => {
    if (params.flow) {
      const match = FLOWS.find((f) => f.key === params.flow);
      if (match) startFlow(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.flow]);

  const reset = () => {
    setFlow(null);
    setStepIndex(0);
    setTextValue('');
    setDone(null);
    setSafetyResponse(null);
    activeResultIds.current = [];
  };

  const finishWithFeedback = async (feedback: InterventionFeedback) => {
    await Promise.all(activeResultIds.current.map((id) => completeIntervention(id, feedback)));
  };

  const advance = async () => {
    if (!flow || !user) return;
    const step = flow.steps[stepIndex];

    if (step.kind === 'intervention' && step.interventionId) {
      const doc = await startIntervention(user.$id, step.interventionId, `emotional_first_aid:${flow.key}`);
      activeResultIds.current.push(doc.$id);
    }

    if (step.kind === 'text') {
      if (!textValue.trim()) return;
      setSubmitting(true);
      try {
        const result = await submitToMentalInbox(textValue.trim());
        if (result.flagged) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          setSafetyResponse(result.response ?? "I want to make sure you're safe — please reach out to someone who can help right now.");
          return;
        }
      } finally {
        setSubmitting(false);
      }
      setTextValue('');
    }

    const isLast = stepIndex === flow.steps.length - 1;
    if (isLast) {
      if (activeResultIds.current.length > 0) await finishWithFeedback('helped');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(flow.key);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleChoice = async (choice: string) => {
    if (!flow) return;
    const feedback = CHOICE_FEEDBACK[choice] ?? 'helped';
    if (activeResultIds.current.length > 0) await finishWithFeedback(feedback);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (flow.key === 'crash' && choice === 'Talking to me more') {
      router.replace('/voice-reflection');
      return;
    }
    if (flow.key === 'crash' && choice === 'Reaching out to someone') {
      router.replace('/talk-to-someone');
      return;
    }
    setDone(flow.key);
  };

  if (safetyResponse) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <AIOrb state="uncertainty" size={72} />
          <Text style={[typography.body, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.xl, maxWidth: 320 }]}>
            {safetyResponse}
          </Text>
          <PrimaryButton label="Back home" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: spacing.xl, width: 220 }} />
        </View>
      </ScreenBackground>
    );
  }

  if (done) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <AIOrb state="success" size={72} />
          <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            That's enough for now.
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 }]}>
            Nothing else is required of you right now.
          </Text>
          <PrimaryButton label="Back home" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: spacing.xl, width: 220 }} />
          <SecondaryButton label="Try something else" onPress={reset} style={{ marginTop: spacing.sm, width: 220 }} />
        </View>
      </ScreenBackground>
    );
  }

  if (!flow) {
    return (
      <ScreenBackground>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <AIOrb state="idle" size={64} />
            <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
              What's going on right now?
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', maxWidth: 280 }]}>
              No diagnosis, no judgment — just pick what's closest.
            </Text>
          </View>
          {FLOWS.map((f, i) => (
            <Animated.View key={f.key} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  startFlow(f);
                }}
                accessibilityRole="button"
                accessibilityLabel={f.label}
              >
                <GlassCard>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Feather name={f.icon} size={20} color={colors.primary} />
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{f.label}</Text>
                    <Feather name="chevron-right" size={18} color={colors.textMuted} />
                  </View>
                </GlassCard>
              </Pressable>
            </Animated.View>
          ))}
          <SecondaryButton label="Not now" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </ScreenBackground>
    );
  }

  const step = flow.steps[stepIndex];
  const orbStateForStep: OrbState = step.kind === 'intervention' ? 'listening' : step.kind === 'text' ? 'thinking' : 'idle';

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <AIOrb state={orbStateForStep} size={56} />
          {stepIndex === 0 && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }]}>
              {flow.intro}
            </Text>
          )}
        </View>

        <GlassCard>
          <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xs }]}>{step.title}</Text>
          {step.body && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>{step.body}</Text>
          )}

          {step.kind === 'text' && (
            <TextField
              placeholder={step.placeholder}
              value={textValue}
              onChangeText={setTextValue}
              multiline
              style={{ minHeight: 80, marginBottom: spacing.md }}
            />
          )}

          {step.kind === 'choice' ? (
            <View style={{ gap: spacing.sm }}>
              {step.choices!.map((c) => (
                <SecondaryButton key={c} label={c} onPress={() => handleChoice(c)} />
              ))}
            </View>
          ) : (
            <PrimaryButton
              label={stepIndex === flow.steps.length - 1 ? 'Finish' : 'Continue'}
              onPress={advance}
              loading={submitting}
              disabled={step.kind === 'text' && !textValue.trim()}
            />
          )}
        </GlassCard>

        <SecondaryButton label="Stop here" onPress={reset} />
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
