import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

const LEVEL_SEGMENTS: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1, none: 0 };
const LEVEL_LABEL: Record<ConfidenceLevel, string> = { high: 'High', medium: 'Medium', low: 'Low', none: 'None yet' };

export interface ConfidenceRow {
  label: string;
  level: ConfidenceLevel;
}

/**
 * Visual answer to spec §52's "Personal Model Confidence" table (Sleep
 * patterns: High / Focus patterns: High / Recovery: Medium / ...) — a
 * segmented bar per dimension instead of a paragraph of prose, so "how
 * much has actually been learned" is scannable rather than read.
 */
export function ConfidenceStrip({ rows }: { rows: ConfidenceRow[] }) {
  const { colors, spacing, typography } = useTheme();

  const barColor = (level: ConfidenceLevel) => {
    if (level === 'high') return colors.success;
    if (level === 'medium') return colors.warning;
    if (level === 'low') return colors.secondary;
    return colors.border;
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row) => {
        const filled = LEVEL_SEGMENTS[row.level];
        const color = barColor(row.level);
        return (
          <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textSecondary, width: 96 }]} numberOfLines={1}>
              {row.label}
            </Text>
            <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: i < filled ? color : colors.border,
                  }}
                />
              ))}
            </View>
            <Text style={[typography.micro, { color, width: 60, textAlign: 'right' }]}>{LEVEL_LABEL[row.level]}</Text>
          </View>
        );
      })}
    </View>
  );
}
