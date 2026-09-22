import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/lib/auth-context';
import { useProfile } from '../../src/lib/profile-context';
import { createCheckin, listRecentCheckins } from '../../src/lib/checkins';
import { PersonalStateVisualization } from '../../src/components/PersonalStateVisualization';
import { MoodSelector, MoodValue } from '../../src/components/MoodSelector';
import { GlassCard } from '../../src/components/GlassCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { AmbientBackground } from '../../src/components/AmbientBackground';
import { EvidenceSheet } from '../../src/components/EvidenceSheet';
import { SuccessBurst } from '../../src/components/SuccessBurst';
import { PressableRow } from '../../src/components/PressableRow';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { fetchPersonalState, StateResult, StateLevel } from '../../src/lib/stateEngine';
import { fetchMomentIntelligence, MomentIntelligenceResult } from '../../src/lib/momentIntelligence';
import { staggerEntering } from '../../src/lib/entrance';
import { ConfidenceStrip, ConfidenceLevel } from '../../src/components/ConfidenceStrip';
import { MinimumViableDay } from '../../src/components/MinimumViableDay';
import { computeCapacity } from '../../src/lib/capacity';
import { computeEmotionalWeather } from '../../src/lib/emotionalWeather';

function levelFromSampleSize(n: number): ConfidenceLevel {
  if (n >= 30) return 'high';
  if (n >= 10) return 'medium';
  if (n > 0) return 'low';
  return 'none';
}

const LEVEL_ROW_LABEL: Record<string, string> = { high: 'Above normal', low: 'Below normal', moderate: 'Normal' };
const LEVEL_ROW_ICON: Record<string, keyof typeof Feather.glyphMap> = { high: 'arrow-up', low: 'arrow-down', moderate: 'minus' };
const DIMENSION_ICON: Record<string, keyof typeof Feather.glyphMap> = { Energy: 'zap', Recovery: 'moon', 'Mental load': 'wind' };

function dateContextLabel(now: Date) {
  return now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

/** One real, grounded sentence for "YOUR STATE" — composed only from
 * already-computed levels/collision data, never a new AI call or invented
 * detail (mirrors the honesty rule the existing briefing evidence sheet
 * already documents for this same data). */
function stateExplanation(
  personalState: StateResult | null,
  rows: { label: string; level: StateLevel }[]
): string | null {
  if (personalState?.collision?.collided) {
    return `${personalState.collision.message} (${personalState.collision.factors.join(', ')}).`;
  }
  if (!personalState) return null;
  const offRow = rows.find((r) => {
    const goodWhenHigh = r.label !== 'Mental load';
    return r.level !== 'moderate' && (r.level === 'high') !== goodWhenHigh;
  });
  if (offRow) return `${offRow.label} looks ${LEVEL_ROW_LABEL[offRow.level].toLowerCase()} today.`;
  if (rows.length > 0) return "Tracking close to your normal range today.";
  return null;
}

/** Rows for the structured briefing card — spec §66's own example is a
 * named list (Sleep / Context / Recovery / Your Move), not a caption
 * sentence. Built only from levels already computed by the state engine —
 * no new fetch, no invented deltas. */
function briefingRows(state: StateResult | null): { label: string; level: StateLevel }[] {
  if (!state?.state) return [];
  const rows: { label: string; level: StateLevel }[] = [];
  if (state.state.energy) rows.push({ label: 'Energy', level: state.state.energy });
  if (state.state.recovery) rows.push({ label: 'Recovery', level: state.state.recovery });
  if (state.state.mentalLoad) rows.push({ label: 'Mental load', level: state.state.mentalLoad });
  return rows;
}

type QuickTile = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  title: string;
  hint: string;
  onPress: () => void;
};

/** Row-card: icon-circle left, title/subtitle center, chevron-circle right —
 * matches the reference's "for you" card treatment instead of a square tile. */
function QuickTile({ tile, index, reduceMotion, stagger }: { tile: QuickTile; index: number; reduceMotion: boolean; stagger: number }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Animated.View entering={staggerEntering(index, reduceMotion, stagger)}>
      <GlassCard compact>
        <PressableRow onPress={tile.onPress} style={{ gap: spacing.sm }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: tile.iconColor + '1F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name={tile.icon} size={18} color={tile.iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{tile.title}</Text>
            <Text style={[typography.micro, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>
              {tile.hint}
            </Text>
          </View>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="arrow-up-right" size={14} color={colors.background} />
          </View>
        </PressableRow>
      </GlassCard>
    </Animated.View>
  );
}

function TileGrid({ tiles, reduceMotion, stagger, gap }: { tiles: QuickTile[]; reduceMotion: boolean; stagger: number; gap: number }) {
  return (
    <View style={{ gap }}>
      {tiles.map((tile, i) => (
        <QuickTile key={tile.key} tile={tile} index={i} reduceMotion={reduceMotion} stagger={stagger} />
      ))}
    </View>
  );
}

function greeting(hour: number) {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Winding down';
}

export default function Home() {
  const { colors, spacing, radius, typography, motion, reduceMotion } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [showAnythingElse, setShowAnythingElse] = useState(false);
  const [personalState, setPersonalState] = useState<StateResult | null>(null);
  const [momentIntel, setMomentIntel] = useState<MomentIntelligenceResult | null>(null);
  const [acknowledgedVeryLow, setAcknowledgedVeryLow] = useState(false);
  const [showAllTiles, setShowAllTiles] = useState(false);
  const evidenceRef = useRef<BottomSheetModal>(null);
  const briefingEvidenceRef = useRef<BottomSheetModal>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docs = await listRecentCheckins(user.$id, 14);
      setCheckins(docs);
      const today = new Date().toDateString();
      setCheckedInToday(docs.some((d: any) => new Date(d.$createdAt).toDateString() === today));
      if (profile?.privacyMode !== 'maximum_privacy') {
        fetchPersonalState()
          .then(setPersonalState)
          .catch(() => setPersonalState(null));
        // Spec §32-33 — real pre/post-moment intelligence from already-synced
        // calendar data and already-stored predictions, never a guess.
        fetchMomentIntelligence()
          .then(setMomentIntel)
          .catch(() => setMomentIntel(null));
      } else {
        setPersonalState(null);
        setMomentIntel(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user, profile?.privacyMode]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!user || !mood) return;
    setSaving(true);
    try {
      await createCheckin({ userId: user.$id, mood });
      // SuccessBurst below is the sole celebration visual.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCelebrating(true);
      // The just-selected mood, not stale closure state — decides whether
      // to offer the "anything else?" follow-up (spec §75). Skipped for a
      // low/struggling mood: Adaptive Friction means capacity is already
      // low, so this isn't the moment to ask for one more thing.
      const justSavedLowCapacity = mood === 'low' || mood === 'struggling';
      await load();
      setTimeout(() => {
        setCelebrating(false);
        if (justSavedLowCapacity) {
          setCheckedInToday(true);
        } else {
          setShowAnythingElse(true);
        }
      }, 2200);
    } finally {
      setSaving(false);
    }
  };

  const firstName = profile?.name?.split(' ')[0] || user?.name?.split(' ')[0] || '';
  const lastMood = checkins[0]?.mood as MoodValue | undefined;
  // Adaptive Capacity Engine — combines every real signal already tracked
  // (mood, mental load, recovery) into one UX-personalization read, rather
  // than the old mood-only binary gate. 'low' keeps the prior behavior
  // (just the check-in and one gentle prompt); 'very_low' goes further,
  // per spec §5, replacing the entire home surface with a minimal,
  // no-questions-asked view.
  const capacity = computeCapacity({
    lastMood,
    mentalLoad: personalState?.state?.mentalLoad ?? null,
    recovery: personalState?.state?.recovery ?? null,
  });
  const lowCapacity = capacity.level === 'low' || capacity.level === 'very_low';
  const veryLowCapacity = capacity.level === 'very_low';
  const weather = computeEmotionalWeather({
    lastMood,
    energy: personalState?.state?.energy ?? null,
    recovery: personalState?.state?.recovery ?? null,
    mentalLoad: personalState?.state?.mentalLoad ?? null,
  });

  // Real energy/recovery reads drive the ambient background's brightness and
  // drift speed (see AmbientBackground) — the one decorative element in the
  // app that's actually tied to real state instead of being pure wallpaper.
  const LEVEL_LIVELINESS: Record<StateLevel, number> = { high: 1, moderate: 0.7, low: 0.45 };
  const liveliness = personalState?.state?.energy
    ? LEVEL_LIVELINESS[personalState.state.energy]
    : 0.7;

  // Two tiles show by default (spec §18's low-density default); the rest
  // are reachable via "See all" rather than deleted — every route below
  // already exists and works, this only changes what's visible up front.
  const FOR_YOU_TILES: QuickTile[] = [
    {
      key: 'try-something-small',
      icon: 'zap',
      iconColor: colors.success,
      title: 'Try something small',
      hint: 'What has actually worked for you before.',
      onPress: () => router.push('/interventions'),
    },
    {
      key: 'your-day',
      icon: 'sunrise',
      iconColor: colors.warning,
      title: 'Your day',
      hint: "Energy and recovery from what's connected.",
      onPress: () => router.push('/today'),
    },
    {
      key: 'what-happened',
      icon: 'clock',
      iconColor: colors.primary,
      title: 'What happened today?',
      hint: 'A real reconstruction, nothing invented.',
      onPress: () => router.push('/what-happened'),
    },
    {
      key: 'mental-inbox',
      icon: 'edit-3',
      iconColor: colors.secondary,
      title: 'Off your mind',
      hint: "Dump a thought — I'll sort it.",
      onPress: () => router.push('/mental-inbox'),
    },
    {
      key: 'voice',
      icon: 'mic',
      iconColor: colors.aiAccent,
      title: 'Talk it out',
      hint: 'Say it instead of typing it.',
      onPress: () => router.push('/voice-reflection'),
    },
    {
      key: 'decisions',
      icon: 'git-branch',
      iconColor: colors.warning,
      title: 'Weighing a decision?',
      hint: "Sort out what you know — I won't decide for you.",
      onPress: () => router.push('/decisions'),
    },
    {
      key: 'pressure-map',
      icon: 'anchor',
      iconColor: colors.critical,
      title: "What's weighing on you?",
      hint: 'Tag it — you tell me, I never guess.',
      onPress: () => router.push('/pressure-map'),
    },
    {
      key: 'community',
      icon: 'users',
      iconColor: colors.secondary,
      title: 'Community',
      hint: 'Presence, circles, and live sessions.',
      onPress: () => router.push('/community'),
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground liveliness={liveliness} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={[typography.micro, { color: colors.textMuted, letterSpacing: 1.5 }]}>
                {dateContextLabel(new Date())}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                A calmer, clearer you.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: colors.primarySoft,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.xs,
                  paddingVertical: 5,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                <Text style={[typography.micro, { color: colors.primary }]}>
                  {checkins.length === 0 ? 'New' : checkins.length < 5 ? 'Learning you' : 'Tracking'}
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={[typography.caption, { color: colors.primary, fontFamily: undefined }]}>
                  {(firstName || 'U')[0].toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.xs }}>
            <Text style={[typography.hero, { color: colors.textPrimary, flex: 1 }]}>
              {greeting(new Date().getHours())}
              {firstName ? `,\n${firstName}` : ''}
            </Text>
            {!lowCapacity && (
              <View style={{ alignItems: 'flex-end', gap: 3, paddingTop: 8, width: 100 }}>
                {['REFLECT', 'UNDERSTAND', 'IMPROVE', 'TOGETHER'].map((w) => (
                  <Text key={w} style={[typography.micro, { color: colors.textMuted, letterSpacing: 1 }]}>
                    {w}
                  </Text>
                ))}
                <View style={{ width: 18, height: 1, backgroundColor: colors.border, marginTop: 4 }} />
              </View>
            )}
          </View>

          {!lowCapacity && (
            <Text
              style={[
                typography.insightQuote,
                { color: colors.textSecondary, textAlign: 'right', alignSelf: 'flex-end', maxWidth: 170 },
              ]}
            >
              Small steps create meaningful change.
            </Text>
          )}

          {!lowCapacity && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm }}>
              {briefingRows(personalState).length > 0 && (
                <View style={{ width: 108, gap: spacing.lg }}>
                  {briefingRows(personalState).map((row) => {
                    // Direction alone doesn't say good/bad the same way for
                    // every dimension (high mental load is worse, high
                    // recovery is better) — color each row by what "high"
                    // actually means for that dimension rather than a single
                    // generic mapping.
                    const goodWhenHigh = row.label !== 'Mental load';
                    const isGood = row.level === 'moderate' ? null : (row.level === 'high') === goodWhenHigh;
                    const rowColor = isGood === null ? colors.textSecondary : isGood ? colors.success : colors.warning;
                    const ratio = row.level === 'low' ? 0.3 : row.level === 'high' ? 0.9 : 0.6;
                    return (
                      <View key={row.label}>
                        <Feather name={DIMENSION_ICON[row.label]} size={14} color={rowColor} />
                        <Text style={[typography.caption, { color: colors.textPrimary, marginTop: 4 }]}>{row.label}</Text>
                        <Text style={[typography.micro, { color: rowColor }]}>{LEVEL_ROW_LABEL[row.level]}</Text>
                        <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.surfaceElevated, marginTop: 5, overflow: 'hidden' }}>
                          <View style={{ width: `${ratio * 100}%`, height: '100%', borderRadius: 2, backgroundColor: rowColor }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <PersonalStateVisualization
                  energy={personalState?.state?.energy ?? null}
                  recovery={personalState?.state?.recovery ?? null}
                  mentalLoad={personalState?.state?.mentalLoad ?? null}
                  size={briefingRows(personalState).length > 0 ? 200 : 250}
                />
              </View>
            </View>
          )}

          {!lowCapacity && (weather || stateExplanation(personalState, briefingRows(personalState))) && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[typography.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
                  Your state
                </Text>
                <PressableRow onPress={() => briefingEvidenceRef.current?.present()} style={{ gap: 4 }}>
                  <Feather name="help-circle" size={12} color={colors.primary} />
                  <Text style={[typography.micro, { color: colors.primary }]}>Why this?</Text>
                </PressableRow>
              </View>
              {weather && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                  <Text style={{ fontSize: 22 }}>{weather.icon}</Text>
                  <Text style={[typography.title, { color: colors.textPrimary }]}>{weather.label}</Text>
                </View>
              )}
              {stateExplanation(personalState, briefingRows(personalState)) && (
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
                  {stateExplanation(personalState, briefingRows(personalState))}
                </Text>
              )}
            </View>
          )}

          <PressableRow onPress={() => router.push('/emotional-first-aid')} style={{ gap: 4, alignSelf: 'center' }}>
            <Feather name="life-buoy" size={12} color={colors.textMuted} />
            <Text style={[typography.micro, { color: colors.textMuted }]}>I need help right now</Text>
          </PressableRow>

          {!lowCapacity && momentIntel?.postMoment && (
            <GlassCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                <Feather name="rewind" size={15} color={colors.secondary} />
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>How that compared</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{momentIntel.postMoment.message}</Text>
            </GlassCard>
          )}

          {!lowCapacity && momentIntel?.preMoment && (
            <GlassCard tint="accent">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                <Feather name="fast-forward" size={15} color={colors.warning} />
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Looking ahead</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{momentIntel.preMoment.message}</Text>
            </GlassCard>
          )}

          {veryLowCapacity && !acknowledgedVeryLow ? (
            <GlassCard tint="accent">
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, textAlign: 'center' }]}>
                You don't have to figure everything out right now.
              </Text>
              <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                <MinimumViableDay />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <PrimaryButton label="I'm here" onPress={() => setAcknowledgedVeryLow(true)} style={{ flex: 1 }} />
                <SecondaryButton label="Talk" onPress={() => router.push('/emotional-first-aid')} style={{ flex: 1 }} />
              </View>
              <SecondaryButton label="Not now" onPress={() => setAcknowledgedVeryLow(true)} style={{ marginTop: spacing.sm }} />
            </GlassCard>
          ) : celebrating ? (
            <GlassCard>
              <SuccessBurst subtitle="That's what I'll compare tomorrow against — no streaks, no pressure, just one more data point that's yours." />
            </GlassCard>
          ) : showAnythingElse ? (
            // Spec §75's own example flow: "Anything else? [Speak] [Skip]"
            // right after the check-in itself — a real, optional on-ramp
            // into voice reflection instead of ending the loop at the mood tap.
            <GlassCard>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' }]}>
                Anything else?
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <PrimaryButton
                  label="Speak"
                  onPress={() => {
                    setCheckedInToday(true);
                    setShowAnythingElse(false);
                    router.push('/voice-reflection');
                  }}
                  style={{ flex: 1 }}
                />
                <SecondaryButton
                  label="Skip"
                  onPress={() => {
                    setCheckedInToday(true);
                    setShowAnythingElse(false);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </GlassCard>
          ) : checkedInToday ? (
            <GlassCard>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>You've checked in today.</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
                {checkins.length < 5
                  ? `${checkins.length} check-in${checkins.length === 1 ? '' : 's'} so far — I need a couple weeks of these before patterns start to mean anything.`
                  : "I'm starting to build a picture of your normal range."}
              </Text>
            </GlassCard>
          ) : (
            <GlassCard>
              <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                How are you feeling?
              </Text>
              <MoodSelector value={mood} onChange={setMood} />
              <PrimaryButton
                label="Save check-in"
                onPress={handleSave}
                loading={saving}
                disabled={!mood}
                style={{ marginTop: spacing.lg }}
              />
            </GlassCard>
          )}

          {lowCapacity && !celebrating && (
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              Keeping this simple today. Everything else is still here when you want it.
            </Text>
          )}

          {lowCapacity ? (
            <QuickTile
              tile={{
                key: 'try-something-small',
                icon: 'zap',
                iconColor: colors.success,
                title: 'Try something small',
                hint: 'Short things that might help right now.',
                onPress: () => router.push('/interventions'),
              }}
              index={0}
              reduceMotion={reduceMotion}
              stagger={motion.duration.stagger}
            />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[typography.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
                  For you
                </Text>
                {FOR_YOU_TILES.length > 2 && (
                  <PressableRow onPress={() => setShowAllTiles((v) => !v)} style={{ gap: 4 }}>
                    <Text style={[typography.micro, { color: colors.primary }]}>{showAllTiles ? 'Show less' : 'See all'}</Text>
                    <Feather name={showAllTiles ? 'chevron-up' : 'chevron-right'} size={12} color={colors.primary} />
                  </PressableRow>
                )}
              </View>

              <TileGrid
                reduceMotion={reduceMotion}
                stagger={motion.duration.stagger}
                gap={spacing.sm}
                tiles={showAllTiles ? FOR_YOU_TILES : FOR_YOU_TILES.slice(0, 2)}
              />

              <Animated.View entering={staggerEntering(5, reduceMotion, motion.duration.stagger)}>
                <GlassCard tint="accent">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.sm, flex: 1 }]}>
                      Personal model confidence
                    </Text>
                  </View>
                  {checkins.length === 0 ? (
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      No data yet — nothing to show. This is intentional: insights only appear once grounded in your own history.
                    </Text>
                  ) : (
                    <ConfidenceStrip
                      rows={[
                        { label: 'Mood', level: levelFromSampleSize(checkins.length) },
                        { label: 'Sleep', level: levelFromSampleSize(personalState?.baselines?.sleepMinutes?.short?.sampleSize ?? 0) },
                        { label: 'Energy', level: levelFromSampleSize(personalState?.baselines?.steps?.short?.sampleSize ?? 0) },
                        { label: 'Mental load', level: levelFromSampleSize(personalState?.baselines?.meetingCount?.short?.sampleSize ?? 0) },
                      ]}
                    />
                  )}
                  <PressableRow onPress={() => evidenceRef.current?.present()} style={{ gap: 4, marginTop: spacing.sm }}>
                    <Feather name="help-circle" size={14} color={colors.primary} />
                    <Text style={[typography.caption, { color: colors.primary }]}>Why this?</Text>
                  </PressableRow>
                </GlassCard>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <EvidenceSheet
        ref={evidenceRef}
        title="How your personal model confidence is calculated"
        confidence={checkins.length === 0 ? 0 : Math.min(checkins.length / 30, 0.95)}
        items={[
          { kind: 'observed', text: `${checkins.length} check-in${checkins.length === 1 ? '' : 's'} recorded so far.` },
          {
            kind: 'inference',
            text: 'Confidence rises with sample size and recency — a single check-in tells me almost nothing about your normal range.',
          },
          {
            kind: 'hypothesis',
            text: 'Once health, calendar or voice reflections are connected, confidence is calculated per-dimension separately (sleep, focus, recovery, etc.) rather than as one number.',
          },
        ]}
      />

      <EvidenceSheet
        ref={briefingEvidenceRef}
        title="How today's briefing is put together"
        items={[
          {
            kind: 'observed',
            text: "Each row compares today's real value (steps, sleep, meeting load) against your own short-term baseline — never a population average.",
          },
          {
            kind: 'inference',
            text: '"Above/below normal" means at least one standard deviation away from your typical range for that dimension, not a fixed threshold.',
          },
          {
            kind: 'pattern',
            text: 'This is arithmetic, not an AI guess — no model call happens to produce this card, only your own recorded history.',
          },
        ]}
      />
    </View>
  );
}
