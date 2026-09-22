import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Share } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { PressableRow } from '../src/components/PressableRow';
import { staggerEntering } from '../src/lib/entrance';
import {
  fetchWellbeingPassport,
  renderPassportText,
  WellbeingPassportResult,
  PassportSectionKey,
} from '../src/lib/wellbeingPassport';

const SECTIONS: { key: PassportSectionKey; label: string }[] = [
  { key: 'whatHelps', label: 'What helps me' },
  { key: 'whatDrains', label: 'What drains me' },
  { key: 'playbooks', label: 'My playbooks' },
  { key: 'pressurePatterns', label: 'Pressure patterns' },
  { key: 'currentExperiments', label: 'Current experiments' },
  { key: 'thingsLearned', label: "Things I've learned" },
];

/** Spec §15/20 — "MY PERSONAL WELLBEING MANUAL." Every section is real,
 * already-tracked history — nothing here is AI-generated or invented. */
export default function WellbeingPassport() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const [loading, setLoading] = useState(true);
  const [passport, setPassport] = useState<WellbeingPassportResult | null>(null);
  const [included, setIncluded] = useState<Set<PassportSectionKey>>(new Set(SECTIONS.map((s) => s.key)));

  useEffect(() => {
    fetchWellbeingPassport().then(setPassport).finally(() => setLoading(false));
  }, []);

  const toggleSection = (key: PassportSectionKey) => {
    Haptics.selectionAsync().catch(() => {});
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleShare = () => {
    if (!passport) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Share.share({ message: renderPassportText(passport, included) }).catch(() => {});
  };

  const hasAnything =
    (passport?.whatHelps?.length ?? 0) > 0 ||
    (passport?.whatDrains?.length ?? 0) > 0 ||
    (passport?.playbooks?.length ?? 0) > 0 ||
    (passport?.pressurePatterns?.length ?? 0) > 0 ||
    (passport?.currentExperiments?.length ?? 0) > 0 ||
    (passport?.thingsLearned?.length ?? 0) > 0;

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="My wellbeing manual" orbState={loading ? 'thinking' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Built only from your real tracked history — nothing invented. Choose what to include before sharing.
        </Text>

        {!loading && !hasAnything && (
          <GlassCard>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
              Nothing to show yet — this fills in as you rate interventions, tag pressure, save playbooks, and run
              experiments.
            </Text>
          </GlassCard>
        )}

        {!loading && passport?.whatHelps && passport.whatHelps.length > 0 && (
          <Animated.View entering={staggerEntering(0, reduceMotion, motion.duration.stagger)}>
            <GlassCard tint="accent">
              <PressableRow
                onPress={() => toggleSection('whatHelps')}
                style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}
                accessibilityLabel={`What helps me, ${included.has('whatHelps') ? 'included' : 'not included'} in share`}
              >
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>What helps me</Text>
                <Feather name={included.has('whatHelps') ? 'check-square' : 'square'} size={18} color={colors.primary} />
              </PressableRow>
              {passport.whatHelps.map((e, i) => (
                <Text key={i} style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {e.title} — helped {e.helped}/{e.attempts} times
                </Text>
              ))}
            </GlassCard>
          </Animated.View>
        )}

        {!loading && passport?.whatDrains && passport.whatDrains.length > 0 && (
          <Animated.View entering={staggerEntering(1, reduceMotion, motion.duration.stagger)}>
            <GlassCard>
              <PressableRow onPress={() => toggleSection('whatDrains')} style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>What drains me</Text>
                <Feather name={included.has('whatDrains') ? 'check-square' : 'square'} size={18} color={colors.primary} />
              </PressableRow>
              {passport.whatDrains.map((e, i) => (
                <Text key={i} style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {e.title} {e.madeWorse ? '— made things worse before' : "— hasn't helped so far"}
                </Text>
              ))}
            </GlassCard>
          </Animated.View>
        )}

        {!loading && passport?.playbooks && passport.playbooks.length > 0 && (
          <Animated.View entering={staggerEntering(2, reduceMotion, motion.duration.stagger)}>
            <GlassCard>
              <PressableRow onPress={() => toggleSection('playbooks')} style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>My playbooks</Text>
                <Feather name={included.has('playbooks') ? 'check-square' : 'square'} size={18} color={colors.primary} />
              </PressableRow>
              {passport.playbooks.map((p, i) => (
                <Text key={i} style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  When "{p.trigger}": {p.steps.join(', ')}
                </Text>
              ))}
            </GlassCard>
          </Animated.View>
        )}

        {!loading && passport?.pressurePatterns && passport.pressurePatterns.length > 0 && (
          <Animated.View entering={staggerEntering(3, reduceMotion, motion.duration.stagger)}>
            <GlassCard>
              <PressableRow onPress={() => toggleSection('pressurePatterns')} style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Pressure patterns</Text>
                <Feather name={included.has('pressurePatterns') ? 'check-square' : 'square'} size={18} color={colors.primary} />
              </PressableRow>
              {passport.pressurePatterns.map((p, i) => (
                <Text key={i} style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {p.area}: tagged {p.count}× {p.active ? '(still active)' : ''}
                </Text>
              ))}
            </GlassCard>
          </Animated.View>
        )}

        {!loading && passport?.currentExperiments && passport.currentExperiments.length > 0 && (
          <Animated.View entering={staggerEntering(4, reduceMotion, motion.duration.stagger)}>
            <GlassCard>
              <PressableRow onPress={() => toggleSection('currentExperiments')} style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Current experiments</Text>
                <Feather name={included.has('currentExperiments') ? 'check-square' : 'square'} size={18} color={colors.primary} />
              </PressableRow>
              {passport.currentExperiments.map((e, i) => (
                <Text key={i} style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {e}
                </Text>
              ))}
            </GlassCard>
          </Animated.View>
        )}

        {!loading && passport?.thingsLearned && passport.thingsLearned.length > 0 && (
          <Animated.View entering={staggerEntering(5, reduceMotion, motion.duration.stagger)}>
            <GlassCard>
              <PressableRow onPress={() => toggleSection('thingsLearned')} style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Things I've learned</Text>
                <Feather name={included.has('thingsLearned') ? 'check-square' : 'square'} size={18} color={colors.primary} />
              </PressableRow>
              {passport.thingsLearned.map((t, i) => (
                <Text key={i} style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {t}
                </Text>
              ))}
            </GlassCard>
          </Animated.View>
        )}

        {!loading && hasAnything && (
          <PrimaryButton label="Share selected sections" onPress={handleShare} disabled={included.size === 0} />
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
