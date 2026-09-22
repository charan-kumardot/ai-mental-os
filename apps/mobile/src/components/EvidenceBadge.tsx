import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Confidence + sample-size line (spec §105's EvidenceBadge) — the same
 * "Confidence: X% · N days of evidence" shape that used to be typed out
 * inline on the counterfactual lab, insight cards and pattern evidence.
 * Never renders a confidence for a claim without one; `evidenceCount` is
 * optional since not every confidence figure has a day count attached.
 */
export function EvidenceBadge({
  confidence,
  evidenceCount,
  evidenceLabel = 'days of evidence',
}: {
  confidence: number;
  evidenceCount?: number;
  evidenceLabel?: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <Text style={[typography.micro, { color: colors.textMuted }]}>
      Confidence: {Math.round(confidence * 100)}%
      {evidenceCount != null ? ` · ${evidenceCount} ${evidenceLabel}` : ''}
    </Text>
  );
}
