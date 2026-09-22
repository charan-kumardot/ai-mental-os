import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/lib/auth-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { GlassCard } from '../src/components/GlassCard';
import { PressableRow } from '../src/components/PressableRow';
import {
  PRESSURE_AREAS,
  PRESSURE_AREA_LABEL,
  PressureArea,
  tagPressure,
  listPressureTags,
  computePressureTrends,
  PressureTrend,
} from '../src/lib/pressureMap';

export default function PressureMap() {
  const { colors, spacing, typography, radius } = useTheme();
  const { user } = useAuth();
  const [trends, setTrends] = useState<PressureTrend[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagging, setTagging] = useState<PressureArea | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docs = await listPressureTags(user.$id);
      setRecentDocs(docs);
      setTrends(computePressureTrends(docs, 30));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTag = async (area: PressureArea) => {
    if (!user) return;
    setTagging(area);
    try {
      await tagPressure(user.$id, area);
      Haptics.selectionAsync().catch(() => {});
      await load();
    } finally {
      setTagging(null);
    }
  };

  const maxCount = Math.max(...trends.map((t) => t.count), 1);
  // "Unresolved" per spec §64 — an area tagged again within the last 7
  // days, i.e. still actively weighing on the user right now, not just
  // ever mentioned once.
  const unresolvedAreas = new Set(
    recentDocs.filter((d) => Date.now() - new Date(d.$createdAt).getTime() < 7 * 86400000).map((d) => d.area)
  );

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Pressure map" orbState={loading ? 'thinking' : trends.some((t) => t.count > 0) ? 'learning' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          You tell me what's weighing on you — I never guess this from anything else.
        </Text>

        <GlassCard>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            What's weighing on you right now?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {PRESSURE_AREAS.map((area) => (
              <PressableRow key={area} onPress={() => handleTag(area)}>
                <Text
                  style={[
                    typography.caption,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.primarySoft,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 6,
                      borderRadius: radius.pill,
                      overflow: 'hidden',
                      opacity: tagging === area ? 0.5 : 1,
                    },
                  ]}
                >
                  {PRESSURE_AREA_LABEL[area]}
                </Text>
              </PressableRow>
            ))}
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Last 30 days
          </Text>
          {trends.every((t) => t.count === 0) ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Nothing tagged yet — tap above whenever something's weighing on you.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {trends
                .filter((t) => t.count > 0)
                .map((t) => (
                  <View key={t.area}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[typography.caption, { color: colors.textPrimary }]}>{PRESSURE_AREA_LABEL[t.area]}</Text>
                        {unresolvedAreas.has(t.area) && (
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning }} />
                        )}
                      </View>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>{t.count}×</Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          width: `${Math.max(6, (t.count / maxCount) * 100)}%`,
                          backgroundColor: colors.aiAccent,
                        }}
                      />
                    </View>
                  </View>
                ))}
            </View>
          )}
          {unresolvedAreas.size > 0 && (
            <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.sm }]}>
              • marks something you've flagged again in the last 7 days — still active, not just history.
            </Text>
          )}
        </GlassCard>
      </ScrollView>
    </ScreenBackground>
  );
}
