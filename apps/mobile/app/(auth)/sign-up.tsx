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

export default function SignUp() {
  const { colors, spacing, typography } = useTheme();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? 'Could not create your account.');
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
              <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.md }]}>
                Let's set things up
              </Text>
              <Text
                style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxs }]}
              >
                No advertising based on your mental state. Nothing sold. Ever.
              </Text>
            </View>

            <GlassCard>
              <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" />
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
                autoComplete="new-password"
              />

              {error ? (
                <Text style={[typography.caption, { color: colors.critical, marginBottom: spacing.md }]}>{error}</Text>
              ) : null}

              <PrimaryButton
                label="Create account"
                onPress={handleSignUp}
                loading={loading}
                disabled={!name || !email || !password}
              />
            </GlassCard>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: 6 }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>Already have an account?</Text>
              <Link href="/(auth)/sign-in">
                <Text style={[typography.bodyMedium, { color: colors.primary }]}>Sign in</Text>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
