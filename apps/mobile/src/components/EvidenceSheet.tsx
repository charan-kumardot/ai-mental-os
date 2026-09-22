import React, { forwardRef, useMemo } from 'react';
import { View, Text } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { StyleSheet, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type EvidenceKind = 'observed' | 'user_reported' | 'pattern' | 'inference' | 'hypothesis';

const KIND_LABEL: Record<EvidenceKind, string> = {
  observed: 'Observed',
  user_reported: 'You told me',
  pattern: 'Repeated pattern',
  inference: 'Inference',
  hypothesis: 'Being tested',
};

export interface EvidenceItem {
  kind: EvidenceKind;
  text: string;
}

/**
 * "Why this?" progressive-disclosure sheet — every non-trivial AI claim
 * should be able to open one of these, showing exactly which evidence
 * category (observed / reported / pattern / inference / hypothesis)
 * backs it. Never a bare assertion with nothing behind it.
 */
export const EvidenceSheet = forwardRef<
  BottomSheetModal,
  { title: string; items: EvidenceItem[]; confidence?: number }
>(({ title, items, confidence }, ref) => {
  const { colors, spacing, typography, radius, scheme } = useTheme();
  const snapPoints = useMemo(() => ['1%', '60%'], []);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      index={1}
      backgroundStyle={{ backgroundColor: 'transparent' }}
      handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={1} disappearsOnIndex={-1} opacity={0.4} />
      )}
    >
      <BlurView
        intensity={Platform.OS === 'android' ? 80 : 60}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}
      />
      <BottomSheetView
        style={{
          padding: spacing.lg,
          backgroundColor: scheme === 'dark' ? 'rgba(32,31,27,0.6)' : 'rgba(255,255,255,0.65)',
        }}
      >
        <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xxs }]}>Why this?</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>{title}</Text>

        {items.map((item, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginBottom: spacing.md,
              alignItems: 'flex-start',
            }}
          >
            <View
              style={{
                paddingHorizontal: spacing.xs,
                paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: colors.primarySoft,
              }}
            >
              <Text style={[typography.micro, { color: colors.primary }]}>{KIND_LABEL[item.kind]}</Text>
            </View>
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{item.text}</Text>
          </View>
        ))}

        {typeof confidence === 'number' && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Confidence: {Math.round(confidence * 100)}% — this updates as more evidence comes in, and can go down as
            well as up.
          </Text>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
EvidenceSheet.displayName = 'EvidenceSheet';
