import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import * as Localization from 'expo-localization';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useProfile } from '../../src/lib/profile-context';
import { useAuth } from '../../src/lib/auth-context';
import { OnboardingScaffold } from '../../src/components/OnboardingScaffold';
import { Chip } from '../../src/components/Chip';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];
const WORK_TYPES = ['Employee', 'Founder/exec', 'Freelancer', 'Student', 'Other'];

export default function ProfileStep() {
  const { colors, spacing, typography } = useTheme();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [name, setName] = useState(user?.name ?? '');
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [workType, setWorkType] = useState<string | null>(null);
  const [occupation, setOccupation] = useState('');
  const [sleepStart, setSleepStart] = useState('23:00');
  const [sleepEnd, setSleepEnd] = useState('07:00');
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name,
        ageRange: ageRange ?? undefined,
        workType: workType ?? undefined,
        occupation,
        sleepScheduleStart: sleepStart,
        sleepScheduleEnd: sleepEnd,
        timezone: Localization.getCalendars()[0]?.timeZone ?? undefined,
        onboardingStep: 'profile',
      });
      router.push('/(onboarding)/permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      step={1}
      totalSteps={4}
      title="A little about you"
      subtitle="This helps personalize baselines from day one."
      footer={<PrimaryButton label="Continue" onPress={handleNext} loading={saving} disabled={!name} />}
    >
      <TextField label="Name" value={name} onChangeText={setName} />
      <TextField label="Occupation (optional)" value={occupation} onChangeText={setOccupation} />

      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Age range</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg }}>
        {AGE_RANGES.map((a) => (
          <Chip key={a} label={a} selected={ageRange === a} onPress={() => setAgeRange(a)} />
        ))}
      </View>

      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Work type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg }}>
        {WORK_TYPES.map((w) => (
          <Chip key={w} label={w} selected={workType === w} onPress={() => setWorkType(w)} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label="Usual bedtime" value={sleepStart} onChangeText={setSleepStart} placeholder="23:00" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Usual wake time" value={sleepEnd} onChangeText={setSleepEnd} placeholder="07:00" />
        </View>
      </View>
    </OnboardingScaffold>
  );
}
