import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { AIOrb, OrbState } from './AIOrb';

/**
 * Standalone screens (outside the tab bar — mental-inbox, voice-reflection,
 * decisions, weekly-review) are pushed via router.push and have no tab bar
 * or native header, so without this they're a dead end unless the user
 * finds the OS back gesture (which can also exit the app entirely from
 * Expo Go — confirmed on-device). Every standalone screen must use this.
 */
export function ScreenHeader({ title, orbState }: { title: string; orbState?: OrbState }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        {/* A long title (e.g. "What happened today") could otherwise grow
            past the screen edge and push the orb off-screen entirely —
            numberOfLines+flexShrink truncates it instead. */}
        <Text
          style={[typography.display, { color: colors.textPrimary, marginLeft: spacing.md, flexShrink: 1 }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {/* A small, persistent cut of the same AIOrb used on Home — ties every
          screen back to one intelligence rather than the orb only existing
          on the check-in flow. Optional: screens with no live AI state
          (e.g. a form) omit it rather than showing a meaningless idle dot. */}
      {orbState && (
        <View style={{ marginLeft: spacing.sm }}>
          <AIOrb size={16} state={orbState} />
        </View>
      )}
    </View>
  );
}
