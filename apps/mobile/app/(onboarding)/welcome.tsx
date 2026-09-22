import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { AIOrb } from '../../src/components/AIOrb';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AmbientBackground } from '../../src/components/AmbientBackground';

export default function Welcome() {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flex: 1 }}>
    <AmbientBackground />
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <AIOrb size={100} />
        <Text style={[typography.display, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.xl }]}>
          Don't just track{'\n'}how you feel.
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, maxWidth: 320 },
          ]}
        >
          Learn what affects your state — and what actually works for you. A few quick questions to get started.
        </Text>
      </View>
      <View style={{ padding: spacing.lg }}>
        <PrimaryButton label="Get started" onPress={() => router.push('/(onboarding)/goals')} />
      </View>
    </SafeAreaView>
    </View>
  );
}
