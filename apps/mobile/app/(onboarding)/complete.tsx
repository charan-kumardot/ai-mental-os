import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useProfile } from '../../src/lib/profile-context';
import { AIOrb } from '../../src/components/AIOrb';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AmbientBackground } from '../../src/components/AmbientBackground';

export default function Complete() {
  const { colors, spacing, typography } = useTheme();
  const { updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateProfile({ onboardingCompleted: true, onboardingStep: 'complete' });
      router.replace('/(tabs)/home');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <AmbientBackground />
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <AIOrb state="success" size={100} />
        <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.xl, textAlign: 'center' }]}>
          You're set up
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, maxWidth: 300 },
          ]}
        >
          I don't know much about you yet — that's normal. Every check-in and reflection makes the next insight
          sharper.
        </Text>
      </View>
      <View style={{ padding: spacing.lg }}>
        <PrimaryButton label="Go to my home" onPress={handleFinish} loading={saving} />
      </View>
    </SafeAreaView>
    </View>
  );
}
