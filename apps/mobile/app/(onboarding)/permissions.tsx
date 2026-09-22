import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useProfile } from '../../src/lib/profile-context';
import { OnboardingScaffold } from '../../src/components/OnboardingScaffold';
import { GlassCard } from '../../src/components/GlassCard';
import { Chip } from '../../src/components/Chip';
import { PrimaryButton } from '../../src/components/PrimaryButton';

const STYLES = [
  { value: 'direct', label: 'Direct', desc: 'Short, straight to the point' },
  { value: 'warm', label: 'Warm', desc: 'Gentle, encouraging tone' },
  { value: 'curious', label: 'Curious', desc: 'Asks questions, explores with you' },
];

export default function Permissions() {
  const { colors, spacing, typography } = useTheme();
  const { updateProfile } = useProfile();
  const [interactionStyle, setInteractionStyle] = useState('warm');
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    setSaving(true);
    try {
      await updateProfile({ interactionStyle, onboardingStep: 'permissions' });
      router.push('/(onboarding)/complete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      step={2}
      totalSteps={4}
      title="How should I talk to you?"
      footer={<PrimaryButton label="Continue" onPress={handleNext} loading={saving} />}
    >
      <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        {STYLES.map((s) => (
          <Pressable
            key={s.value}
            onPress={() => setInteractionStyle(s.value)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <GlassCard
              style={{
                borderColor: interactionStyle === s.value ? colors.primary : colors.border,
                borderWidth: 1.5,
              }}
            >
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{s.label}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{s.desc}</Text>
            </GlassCard>
          </Pressable>
        ))}
      </View>

      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Health, calendar and notification connections can be added anytime from Privacy settings — none are
        required to use the app.
      </Text>
    </OnboardingScaffold>
  );
}
