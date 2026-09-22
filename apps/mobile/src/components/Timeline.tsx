import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export interface TimelineItem {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  content: string;
  dateLabel: string;
  color?: string;
}

/**
 * Spec §105's named `Timeline` component — a real, chronological record of
 * what's actually been learned (memory_items, in createdAt order), not a
 * synthesized "3 months ago X mattered" narrative. Building the honest
 * version of this now; the AI-summarized longitudinal-change narrative
 * (§40/§83) is a separate feature needing new backend aggregation, not
 * included here — this only visualizes real, already-fetched records.
 */
export function Timeline({ items }: { items: TimelineItem[] }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const dotColor = item.color ?? colors.aiAccent;
        return (
          <View key={item.id} style={{ flexDirection: 'row' }}>
            <View style={{ alignItems: 'center', width: 28 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: dotColor + '26',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name={item.icon} size={11} color={dotColor} />
              </View>
              {!isLast && <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border, marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.md, paddingLeft: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textPrimary }]}>{item.content}</Text>
              <Text style={[typography.micro, { color: colors.textMuted, marginTop: 2 }]}>{item.dateLabel}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
