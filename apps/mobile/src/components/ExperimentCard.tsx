import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { GlassCard } from './GlassCard';

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

/**
 * Spec §105's ExperimentCard — a hypothesis in progress reads differently
 * from a settled one (dashed while open, solid and outcome-colored once
 * concluded, muted once abandoned), so the border itself carries state.
 * The interactive footer (conclude/abandon controls, inline edit form)
 * stays owned by the screen via `children` since it's tightly coupled to
 * that screen's own state machine, not reusable display.
 */
export function ExperimentCard({
  hypothesis,
  status,
  conclusion,
  children,
}: {
  hypothesis: string;
  status: string;
  conclusion?: string;
  children?: React.ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();

  const cardStyle = (() => {
    if (status === 'abandoned') {
      return { borderStyle: 'dashed' as const, borderColor: colors.border, opacity: 0.6 };
    }
    if (status === 'completed') {
      const outcomeColor = conclusion?.startsWith('Confirmed')
        ? colors.success
        : conclusion?.startsWith('Not confirmed')
          ? colors.warning
          : colors.textMuted;
      return { borderStyle: 'solid' as const, borderColor: outcomeColor, borderWidth: 1.5 };
    }
    return { borderStyle: 'dashed' as const, borderColor: colors.aiAccent, borderWidth: 1.5 };
  })();

  return (
    <GlassCard style={cardStyle}>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{hypothesis}</Text>
      <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.xs }]}>
        Status: {STATUS_LABEL[status] ?? status}
      </Text>
      {conclusion && (
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>{conclusion}</Text>
      )}
      {children}
    </GlassCard>
  );
}
