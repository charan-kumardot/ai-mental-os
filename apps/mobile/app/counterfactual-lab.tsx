import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { AIOrb } from '../src/components/AIOrb';
import { EvidenceBadge } from '../src/components/EvidenceBadge';
import { fetchPatterns } from '../src/lib/patterns';
import { buildCounterfactuals, Counterfactual } from '../src/lib/counterfactual';
import { staggerEntering } from '../src/lib/entrance';

export default function CounterfactualLab() {
  const { colors, spacing, typography, reduceMotion, motion } = useTheme();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Counterfactual[]>([]);

  useEffect(() => {
    fetchPatterns()
      .then((r) => setItems(buildCounterfactuals(r.patterns ?? [])))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="What if?" orbState={loading ? 'thinking' : items.length > 0 ? 'insight' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Ask "what if" about the real connections I've found in your own history — never a guarantee, always
          grounded in your own days.
        </Text>

        {!loading && items.length === 0 && (
          <GlassCard>
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <AIOrb size={44} state="idle" />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
                Nothing to ask yet
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs, textAlign: 'center', maxWidth: 280 }]}>
                Once real patterns emerge between things like sleep, meetings and mood, they'll show up here as
                questions you can explore — never invented ahead of time.
              </Text>
            </View>
          </GlassCard>
        )}

        {items.map((item, i) => (
          <Animated.View key={item.id} entering={staggerEntering(i, reduceMotion, motion.duration.stagger)}>
            <GlassCard tint="accent">
              <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {item.question}
              </Text>
              <Text style={[typography.insightQuote, { color: colors.textSecondary }]}>{item.answer}</Text>
              <View style={{ marginTop: spacing.sm }}>
                <EvidenceBadge confidence={item.confidence} evidenceCount={item.evidenceCount} />
              </View>
            </GlassCard>
          </Animated.View>
        ))}
      </ScrollView>
    </ScreenBackground>
  );
}
