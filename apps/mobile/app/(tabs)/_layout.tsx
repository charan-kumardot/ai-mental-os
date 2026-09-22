import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { AIOrb } from '../../src/components/AIOrb';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function TabIcon({ name, focused, color }: { name: FeatherName; focused: boolean; color: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.primary + '1A' : 'transparent',
      }}
    >
      <Feather name={name} size={20} color={color} style={{ opacity: focused ? 1 : 0.7 }} />
    </View>
  );
}

/** Home's tab icon is the small living orb rather than a line icon — Home
 * is genuinely where the Personal State Visualization/orb concept lives,
 * so this echoes the reference's "one tab feels alive" nav detail without
 * inventing a separate "Ask" destination this app doesn't have. */
function HomeTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={{ width: 40, height: 28, alignItems: 'center', justifyContent: 'center', marginTop: -6 }}>
      <AIOrb size={9} state="idle" />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  // The device's own on-screen nav bar (3-button navigation) reserves real
  // space at the bottom and draws on top of anything absolutely positioned
  // there — without accounting for it, the tab bar's labels (and the bottom
  // slice of its tap targets) end up genuinely unreachable, not just a
  // visual overlap. Gesture-nav devices report insets.bottom ~0, so this is
  // a no-op there.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={Platform.OS === 'android' ? 80 : 55}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <HomeTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ focused, color }) => <TabIcon name="zap" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="experiments"
        options={{
          title: 'Experiments',
          tabBarIcon: ({ focused, color }) => <TabIcon name="compass" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="brain"
        options={{
          title: 'Brain',
          tabBarIcon: ({ focused, color }) => <TabIcon name="git-merge" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ focused, color }) => <TabIcon name="user" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
