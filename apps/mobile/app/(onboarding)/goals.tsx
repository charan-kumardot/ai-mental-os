import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useProfile, Mode } from '../../src/lib/profile-context';
import { OnboardingScaffold } from '../../src/components/OnboardingScaffold';
import { Chip } from '../../src/components/Chip';
import { PrimaryButton } from '../../src/components/PrimaryButton';

const GOALS = [
  'Stress',
  'Energy',
  'Focus',
  'Sleep',
  'Recovery',
  'Emotional balance',
  'Mental clarity',
  'Sustainable performance',
];

const MODES: { value: Mode; label: string; desc: string }[] = [
  { value: 'feel_better', label: 'Feel better', desc: 'Stress, energy, emotional balance, difficult days' },
  { value: 'perform_better', label: 'Perform better', desc: 'Focus, recovery, sustainable high performance' },
  { value: 'both', label: 'Both', desc: 'One brain, both lenses' },
];

export default function Goals() {
  const { colors, spacing, typography, radius } = useTheme();
  const { updateProfile } = useProfile();
  const [mode, setMode] = useState<Mode>('both');
  const [goals, setGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleGoal = (g: string) => {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      await updateProfile({ mode, goals, onboardingStep: 'goals' });
      router.push('/(onboarding)/profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      step={0}
      totalSteps={4}
      title="What brings you here?"
      subtitle="You can change this anytime."
      footer={<PrimaryButton label="Continue" onPress={handleNext} loading={saving} disabled={goals.length === 0} />}
    >
      <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => setMode(m.value)}
            style={({ pressed }) => ({
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: mode === m.value ? colors.primary : colors.border,
              backgroundColor: mode === m.value ? colors.primarySoft : colors.surface,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{m.label}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{m.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
        What would you like help with? (pick any)
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {GOALS.map((g) => (
          <Chip key={g} label={g} selected={goals.includes(g)} onPress={() => toggleGoal(g)} />
        ))}
      </View>
    </OnboardingScaffold>
  );
}
