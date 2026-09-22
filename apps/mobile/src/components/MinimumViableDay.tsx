import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

const ITEMS: { key: string; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'water', icon: 'droplet', label: 'Drink some water' },
  { key: 'food', icon: 'coffee', label: 'Eat something' },
  { key: 'move', icon: 'activity', label: 'A little movement' },
  { key: 'connect', icon: 'message-circle', label: 'One human connection' },
  { key: 'sleep', icon: 'moon', label: "Protect tonight's sleep" },
  { key: 'task', icon: 'check-circle', label: 'One meaningful task, if any' },
];

/**
 * Spec feature "Minimum Viable Day" — deliberately has no backend write and
 * no persistence. This is not a tracked checklist (that would just be a
 * to-do list with guilt attached the moment a day resets uncompleted);
 * it's a one-time reframe of what "enough" looks like today. Checking an
 * item does nothing except let the user see fewer things left unchecked —
 * nothing is recorded, nothing is graded, nothing carries into tomorrow.
 */
export function MinimumViableDay() {
  const { colors, spacing, typography } = useTheme();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={{ gap: spacing.xs }}>
      {ITEMS.map((item) => {
        const isChecked = checked.has(item.key);
        return (
          <Pressable
            key={item.key}
            onPress={() => toggle(item.key)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 }}
          >
            <Feather
              name={isChecked ? 'check-circle' : 'circle'}
              size={18}
              color={isChecked ? colors.success : colors.textMuted}
            />
            <Text
              style={[
                typography.caption,
                { color: isChecked ? colors.textMuted : colors.textPrimary, textDecorationLine: isChecked ? 'line-through' : 'none' },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.xs }]}>
        Choose what's realistic. Nothing here is tracked or graded.
      </Text>
    </View>
  );
}
