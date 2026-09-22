import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/lib/auth-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { useProfile } from '../src/lib/profile-context';

/**
 * Entry redirect: routes to auth, onboarding, or the main tabs
 * depending on session + profile completion state.
 */
export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { colors } = useTheme();

  const loading = authLoading || (!!user && profileLoading);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/sign-in');
    } else if (!profile?.onboardingCompleted) {
      router.replace('/(onboarding)/welcome');
    } else {
      router.replace('/(tabs)/home');
    }
  }, [loading, user, profile]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
