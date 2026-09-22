import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/lib/auth-context';
import { AIOrb } from '../../src/components/AIOrb';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { GlassCard } from '../../src/components/GlassCard';
import { AmbientBackground } from '../../src/components/AmbientBackground';

export default function SignIn() {
  const { colors, spacing, typography } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? 'Could not sign in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
              <AIOrb size={64} />
              <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.md }]}>Welcome back</Text>
              <Text
                style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxs }]}
              >
                Your mind. Your data. Your control.
              </Text>
            </View>

            <GlassCard>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />

              {error ? (
                <Text style={[typography.caption, { color: colors.critical, marginBottom: spacing.md }]}>{error}</Text>
              ) : null}

              <PrimaryButton label="Sign in" onPress={handleSignIn} loading={loading} disabled={!email || !password} />
            </GlassCard>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: 6 }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>New here?</Text>
              <Link href="/(auth)/sign-up">
                <Text style={[typography.bodyMedium, { color: colors.primary }]}>Create an account</Text>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
