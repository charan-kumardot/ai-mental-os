import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Share, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { TextField } from '../src/components/TextField';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { draftProfessionalSummary } from '../src/lib/messageDrafting';

/**
 * Professional Handoff (spec §16) — "Prepare for a professional
 * conversation." Never diagnoses; assembled only from real patterns and
 * concluded experiments already in this account's history.
 */
export default function ProfessionalHandoff() {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [skippedMessage, setSkippedMessage] = useState<string | null>(null);

  useEffect(() => {
    draftProfessionalSummary()
      .then((result) => {
        if (result.skipped) setSkippedMessage(result.message ?? null);
        else setSummary(result.summary ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Prepare for a conversation" orbState={loading ? 'thinking' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          A summary to bring to a therapist, doctor, or coach — built only from real patterns and things you've
          actually tried. Not a diagnosis.
        </Text>

        {!loading && skippedMessage && (
          <GlassCard>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>{skippedMessage}</Text>
          </GlassCard>
        )}

        {!loading && !skippedMessage && (
          <GlassCard tint="accent">
            <TextField value={summary} onChangeText={setSummary} multiline style={{ minHeight: 220 }} />
            <PrimaryButton
              label="Share"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                Share.share({ message: summary.trim() }).catch(() => {});
              }}
              disabled={!summary.trim()}
              style={{ marginTop: spacing.md }}
            />
          </GlassCard>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
