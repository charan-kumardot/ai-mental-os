import React, { useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

export type MoodValue = 'great' | 'good' | 'okay' | 'low' | 'struggling';

const MOODS: { value: MoodValue; emoji: string; label: string }[] = [
  { value: 'struggling', emoji: '😣', label: 'Struggling' },
  { value: 'low', emoji: '😕', label: 'Low' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'great', emoji: '😌', label: 'Great' },
];

function MoodOption({
  emoji,
  label,
  selected,
  onSelect,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, radius, spacing, motion } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          scale.value = withSpring(1.18, motion.spring.normal, () => {
            scale.value = withSpring(1, motion.spring.normal);
          });
          onSelect();
        }}
        style={[
          styles.option,
          {
            backgroundColor: selected ? colors.primarySoft : 'transparent',
            borderRadius: radius.pill,
            padding: spacing.xs,
          },
        ]}
      >
        <Text style={{ fontSize: 34 }}>{emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function MoodSelector({
  value,
  onChange,
}: {
  value: MoodValue | null;
  onChange: (v: MoodValue) => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const selectedLabel = MOODS.find((m) => m.value === value)?.label;

  return (
    <View>
      <View style={styles.row}>
        {MOODS.map((m) => (
          <MoodOption
            key={m.value}
            emoji={m.emoji}
            label={m.label}
            selected={value === m.value}
            onSelect={() => onChange(m.value)}
          />
        ))}
      </View>
      <Text
        style={[
          typography.caption,
          { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, height: 18 },
        ]}
      >
        {selectedLabel ?? ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  option: { alignItems: 'center', justifyContent: 'center' },
});
