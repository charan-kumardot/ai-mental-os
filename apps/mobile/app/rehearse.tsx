import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
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
import { rehearseConversation, RehearsalMode } from '../src/lib/conversationTools';
import { staggerEntering } from '../src/lib/entrance';

const MODES: { key: RehearsalMode; label: string }[] = [
  { key: 'difficult_conversation', label: 'Difficult conversation' },
  { key: 'interview', label: 'Interview' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'boundary', label: 'Boundary' },
  { key: 'apology', label: 'Apology' },
  { key: 'asking_for_help', label: 'Asking for help' },
  { key: 'manager_conversation', label: 'Manager conversation' },
  { key: 'relationship_conversation', label: 'Relationship conversation' },
];

/** Spec §19 — Conversation Rehearsal. Feedback is about the words, never
 * a score on the person. */
export default function Rehearse() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const [mode, setMode] = useState<RehearsalMode | null>(null);
  const [situation, setSituation] = useState('');
  const [plannedWords, setPlannedWords] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleRun = async () => {
    if (!mode || !situation.trim() || !plannedWords.trim()) return;
    setRunning(true);
    try {
      const res = await rehearseConversation(mode, situation.trim(), plannedWords.trim());
      setResult(res.result ?? "Couldn't run that rehearsal — try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setRunning(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Rehearse" orbState={running ? 'thinking' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Practice before the real thing. I'll play the other person's likely reaction and give feedback on the
          words, not on you.
        </Text>

        {!mode && (
          <GlassCard>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>What kind of conversation?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {MODES.map((m, i) => (
                <Animated.View key={m.key} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                  <SecondaryButton label={m.label} onPress={() => setMode(m.key)} accessibilityLabel={`Rehearse a ${m.label.toLowerCase()}`} />
                </Animated.View>
              ))}
            </View>
          </GlassCard>
        )}

        {mode && !result && (
          <GlassCard>
            <TextField
              label="What's the situation?"
              placeholder="Who is this with, and what's going on…"
              value={situation}
              onChangeText={setSituation}
              multiline
              style={{ marginBottom: spacing.md }}
            />
            <TextField
              label="What do you plan to say?"
              placeholder="Write roughly what you'd say…"
              value={plannedWords}
              onChangeText={setPlannedWords}
              multiline
            />
            <PrimaryButton
              label="Rehearse it"
              onPress={handleRun}
              loading={running}
              disabled={!situation.trim() || !plannedWords.trim()}
              style={{ marginTop: spacing.md }}
            />
          </GlassCard>
        )}

        {result && (
          <GlassCard tint="accent">
            <Text style={[typography.insightQuote, { color: colors.textPrimary }]}>{result}</Text>
            <SecondaryButton label="Try again" onPress={() => setResult(null)} style={{ marginTop: spacing.md }} />
          </GlassCard>
        )}

        <SecondaryButton label="Not now" onPress={() => router.back()} />
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
