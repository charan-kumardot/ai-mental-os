import React, { forwardRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';
import { TextField } from './TextField';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { MemoryItem, forgetMemory, markMemoryOutdated, correctMemory } from '../lib/memory';

function relativeDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Spec §28's "Why do you remember this?" — every memory can be corrected,
 * marked outdated, or forgotten outright, not just displayed forever once
 * written. Mutations go through the real generate-insight actions (memory
 * is server-only), so this reflects the actual stored record, not local
 * optimism.
 */
export const MemoryTransparencySheet = forwardRef<
  BottomSheetModal,
  { memory: MemoryItem | null; onChanged: () => void }
>(({ memory, onChanged }, ref) => {
  const { colors, spacing, typography, radius, scheme } = useTheme();
  const snapPoints = React.useMemo(() => ['1%', '55%'], []);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEditing(false);
    setDraft(memory?.content ?? '');
  }, [memory?.id]);

  if (!memory) return null;

  const handleForget = async () => {
    setBusy(true);
    try {
      await forgetMemory(memory.id);
      onChanged();
      (ref as any)?.current?.dismiss();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleOutdated = async () => {
    setBusy(true);
    try {
      await markMemoryOutdated(memory.id, !memory.outdated);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await correctMemory(memory.id, draft.trim());
      onChanged();
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

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
        style={{ padding: spacing.lg, backgroundColor: scheme === 'dark' ? 'rgba(32,31,27,0.6)' : 'rgba(255,255,255,0.65)' }}
      >
        <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xxs }]}>
          Why do you remember this?
        </Text>

        {editing ? (
          <>
            <TextField value={draft} onChangeText={setDraft} multiline style={{ minHeight: 80, marginTop: spacing.md }} />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <PrimaryButton label="Save correction" onPress={handleSaveCorrection} loading={busy} disabled={!draft.trim()} style={{ flex: 1 }} />
              <SecondaryButton label="Cancel" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.lg }]}>
              "{memory.content}"
            </Text>

            <View style={{ gap: 6, marginBottom: spacing.lg }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Source: {memory.source ?? memory.type}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Recorded: {relativeDate(memory.createdAt)}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Sensitivity: {memory.sensitivity}</Text>
              {typeof memory.importance === 'number' && (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Importance: {Math.round(memory.importance * 100)}%
                </Text>
              )}
              {memory.outdated && (
                <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>Marked outdated</Text>
              )}
            </View>

            <View style={{ gap: spacing.sm }}>
              <SecondaryButton label="Correct this" onPress={() => setEditing(true)} />
              <SecondaryButton
                label={memory.outdated ? 'Restore (no longer outdated)' : 'Mark as outdated'}
                onPress={handleToggleOutdated}
                loading={busy}
              />
              <SecondaryButton label="Forget this" onPress={handleForget} loading={busy} />
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
MemoryTransparencySheet.displayName = 'MemoryTransparencySheet';
