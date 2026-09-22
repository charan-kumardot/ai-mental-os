import React, { useCallback, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar as RNStatusBar, Platform, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { AuthProvider, useAuth } from '../src/lib/auth-context';
import { ProfileProvider } from '../src/lib/profile-context';
import { databases, DB_ID, COLLECTIONS, Query } from '../src/lib/appwrite';
import { reconcileDailyReminder, recordReminderOpened, isDailyReminderNotification, addNotificationOpenedListener } from '../src/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

const REMINDER_HOUR = 20;
const REMINDER_MINUTE = 0;

function InnerLayout() {
  const { colors, scheme } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent', true);
    }
  }, []);

  // Interruption Value Engine (spec §50) — re-evaluate the daily reminder
  // every time the app is foregrounded, since local notifications here are
  // one-time triggers the engine can veto, not a blind recurring alarm.
  // Only reconciles when the user has actually opted in.
  useEffect(() => {
    if (!user) return;
    const reconcileIfEnabled = async () => {
      const prefs = await databases
        .listDocuments(DB_ID, COLLECTIONS.notificationsPrefs, [Query.equal('userId', user.$id), Query.limit(1)])
        .catch(() => ({ documents: [] as any[] }));
      const enabled = (prefs.documents[0] as any)?.categoriesEnabled?.includes('daily_checkin_reminder');
      if (enabled) await reconcileDailyReminder(user.$id, REMINDER_HOUR, REMINDER_MINUTE);
    };
    reconcileIfEnabled();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcileIfEnabled();
    });
    return () => sub.remove();
  }, [user?.$id]);

  useEffect(() => {
    if (!user) return;
    const unsub = addNotificationOpenedListener((identifier) => {
      if (isDailyReminderNotification(identifier)) recordReminderOpened(user.$id);
    });
    return () => unsub();
  }, [user?.$id]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  const onLayout = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <ThemeProvider>
        <AuthProvider>
          <ProfileProvider>
            <BottomSheetModalProvider>
              <InnerLayout />
            </BottomSheetModalProvider>
          </ProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
