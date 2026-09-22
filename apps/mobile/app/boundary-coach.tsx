import React, { useState } from 'react';
import { View, Text, ScrollView, Share, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { TextField } from '../src/components/TextField';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { draftBoundaryMessage, BoundaryInput, BoundaryTone } from '../src/lib/conversationTools';
import { staggerEntering } from '../src/lib/entrance';

const STEPS: { key: keyof BoundaryInput; label: string; placeholder: string }[] = [
  { key: 'whatHappened', label: 'What happened?', placeholder: 'The situation…' },
  { key: 'whatYouWant', label: 'What do you want?', placeholder: 'The outcome you want…' },
  { key: 'comfortable', label: "What are you comfortable with?", placeholder: '…' },
  { key: 'negotiable', label: "What's negotiable?", placeholder: '…' },
  { key: 'notNegotiable', label: "What's NOT negotiable?", placeholder: '…' },
];

const TONES: { key: BoundaryTone; label: string }[] = [
  { key: 'gentle', label: 'Gentle' },
  { key: 'direct', label: 'Direct' },
  { key: 'professional', label: 'Professional' },
  { key: 'warm', label: 'Warm' },
  { key: 'short', label: 'Short' },
];

/** Spec §20 — Boundary Coach. Structures the boundary before drafting so
 * the non-negotiable part never gets softened into a compromise. */
export default function BoundaryCoach() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState<BoundaryInput>({
    whatHappened: '',
    whatYouWant: '',
    comfortable: '',
    negotiable: '',
    notNegotiable: '',
  });
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const step = STEPS[stepIndex];
  const done = stepIndex >= STEPS.length;

  const handleTone = async (tone: BoundaryTone) => {
    setDrafting(true);
    try {
      const res = await draftBoundaryMessage(input, tone);
      setDraft(res.draft ?? "Couldn't draft that — try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setDrafting(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Boundary coach" orbState={drafting ? 'thinking' : 'idle'} />

        {!done && !draft && (
          <GlassCard>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>{step.label}</Text>
            <TextField
              placeholder={step.placeholder}
              value={input[step.key]}
              onChangeText={(v) => setInput((prev) => ({ ...prev, [step.key]: v }))}
              multiline
              style={{ minHeight: 80 }}
            />
            <PrimaryButton
              label={stepIndex === STEPS.length - 1 ? 'Continue to tone' : 'Next'}
              onPress={() => setStepIndex((i) => i + 1)}
              disabled={!input[step.key].trim()}
              style={{ marginTop: spacing.md }}
            />
          </GlassCard>
        )}

        {done && !draft && (
          <GlassCard>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>What tone?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {TONES.map((t, i) => (
                <Animated.View key={t.key} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                  <SecondaryButton label={t.label} onPress={() => handleTone(t.key)} loading={drafting} accessibilityLabel={`Draft in a ${t.label.toLowerCase()} tone`} />
                </Animated.View>
              ))}
            </View>
          </GlassCard>
        )}

        {draft && (
          <GlassCard tint="accent">
            <TextField value={draft} onChangeText={setDraft} multiline style={{ minHeight: 120 }} />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <PrimaryButton
                label="Share"
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  Share.share({ message: draft.trim() }).catch(() => {});
                }}
                style={{ flex: 1 }}
              />
              <SecondaryButton label="Try another tone" onPress={() => setDraft(null)} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        )}

        <SecondaryButton label="Not now" onPress={() => router.back()} />
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
