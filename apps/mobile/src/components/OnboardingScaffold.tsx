import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { AmbientBackground } from './AmbientBackground';

export function OnboardingScaffold({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  footer,
}: {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: i <= step ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}>
          <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.lg }]}>{title}</Text>
          {subtitle ? (
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xxs }]}>{subtitle}</Text>
          ) : null}
          <View style={{ marginTop: spacing.xl, flex: 1 }}>{children}</View>
        </ScrollView>
        <View style={{ padding: spacing.lg }}>{footer}</View>
      </SafeAreaView>
    </View>
  );
}
