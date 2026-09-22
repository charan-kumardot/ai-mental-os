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
import { draftPersonalMessage, RecipientType } from '../src/lib/messageDrafting';
import { staggerEntering } from '../src/lib/entrance';

const RECIPIENTS: { key: RecipientType; label: string }[] = [
  { key: 'partner', label: 'Partner' },
  { key: 'friend', label: 'Friend' },
  { key: 'family', label: 'Family' },
  { key: 'manager', label: 'Manager' },
  { key: 'colleague', label: 'Colleague' },
  { key: 'therapist', label: 'Therapist' },
  { key: 'professional', label: 'Other professional' },
];

/**
 * Social Support Bridge / "Help me talk to someone" (spec §13-14). The
 * draft is always editable and never sent automatically — sharing it is a
 * deliberate, separate action the user takes through the OS share sheet,
 * to whoever they choose, not a contact this app picked.
 */
export default function TalkToSomeone() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const [recipient, setRecipient] = useState<RecipientType | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState('');
  const [skippedMessage, setSkippedMessage] = useState<string | null>(null);

  const handlePick = async (r: RecipientType) => {
    setRecipient(r);
    setDrafting(true);
    setSkippedMessage(null);
    try {
      const result = await draftPersonalMessage(r);
      if (result.skipped) {
        setSkippedMessage(result.message ?? "Couldn't draft this yet — try writing it yourself below.");
        setDraft('');
      } else {
        setDraft(result.draft ?? '');
      }
    } finally {
      setDrafting(false);
    }
  };

  const handleShare = () => {
    if (!draft.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Share.share({ message: draft.trim() }).catch(() => {});
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Talk to someone" orbState={drafting ? 'thinking' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          This might be easier with someone you trust. I'll draft something — you decide whether to send it, and to whom.
        </Text>

        {!recipient && (
          <GlassCard>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Who is this for?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {RECIPIENTS.map((r, i) => (
                <Animated.View key={r.key} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
                  <SecondaryButton label={r.label} onPress={() => handlePick(r.key)} accessibilityLabel={`Draft a message to your ${r.label.toLowerCase()}`} />
                </Animated.View>
              ))}
            </View>
          </GlassCard>
        )}

        {recipient && (
          <GlassCard tint="accent">
            <Text style={[typography.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }]}>
              Draft to your {RECIPIENTS.find((r) => r.key === recipient)?.label.toLowerCase()}
            </Text>
            {skippedMessage && (
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>{skippedMessage}</Text>
            )}
            <TextField value={draft} onChangeText={setDraft} multiline style={{ minHeight: 120 }} placeholder="Write it yourself…" />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <PrimaryButton label="Share" onPress={handleShare} disabled={!draft.trim()} style={{ flex: 1 }} />
              <SecondaryButton label="Choose someone else" onPress={() => setRecipient(null)} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        )}

        <SecondaryButton label="Not now" onPress={() => router.back()} />
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
