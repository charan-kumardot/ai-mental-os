import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/lib/auth-context';
import { useProfile } from '../../src/lib/profile-context';
import { databases, DB_ID, COLLECTIONS, Query } from '../../src/lib/appwrite';
import { GlassCard } from '../../src/components/GlassCard';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { PersonalGraph } from '../../src/components/PersonalGraph';
import { AIOrb } from '../../src/components/AIOrb';
import { AnimatedNumber } from '../../src/components/AnimatedNumber';
import { EvidenceSheet, EvidenceItem } from '../../src/components/EvidenceSheet';
import { OperatingManualCard } from '../../src/components/OperatingManualCard';
import { PressableRow } from '../../src/components/PressableRow';
import { fetchOperatingManual, OperatingManualSection } from '../../src/lib/operatingManual';
import { listInterventionResults, computeAutopilotRanking } from '../../src/lib/interventions';
import { fetchPatterns, Pattern } from '../../src/lib/patterns';
import { listMemories, MemoryItem } from '../../src/lib/memory';
import { MemoryTransparencySheet } from '../../src/components/MemoryTransparencySheet';

const MEMORY_ICON: Record<MemoryItem['type'], keyof typeof Feather.glyphMap> = {
  episodic: 'clock',
  semantic: 'book',
  pattern: 'share-2',
  intervention: 'zap',
  experiment: 'compass',
};

const MANUAL_SECTION_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  focus: 'sunrise',
  whatsWorked: 'check-circle',
  noticed: 'eye',
};

const MEMORY_COLOR_KEY: Record<MemoryItem['type'], 'warning' | 'accentLavender' | 'aiAccent' | 'success' | 'secondary'> = {
  episodic: 'warning',
  semantic: 'accentLavender',
  pattern: 'aiAccent',
  intervention: 'success',
  experiment: 'secondary',
};

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const DIMENSION_DISPLAY: Record<string, string> = {
  mood: 'mood',
  sleepMinutes: 'sleep',
  steps: 'steps',
  meetingCount: 'meeting count',
  meetingMinutes: 'meeting load',
};

// Patterns correlate raw dimensions (mood, sleepMinutes, ...), but the graph's
// nodes are the data SOURCES those dimensions actually come from — this maps
// one to the other so a real "mood ↔ sleep" pattern draws as a real edge
// between the "Check-ins" and "Health data" nodes, not an invented one.
const DIMENSION_TO_SOURCE: Record<string, string> = {
  mood: 'checkins',
  sleepMinutes: 'health',
  steps: 'health',
  meetingCount: 'calendar',
  meetingMinutes: 'calendar',
};

// "Mood" is tracked via check-ins and "Sleep" via Health Connect once
// connected. Focus/Recovery have no real tracked source yet — no derived
// score exists for them, so they honestly show "None yet" rather than
// inventing one from raw steps/calendar data.
const DIMENSIONS = [
  { key: 'mood', label: 'Mood', icon: 'smile' as const },
  { key: 'focus', label: 'Focus', icon: 'target' as const },
  { key: 'recovery', label: 'Recovery', icon: 'battery-charging' as const },
  { key: 'sleep', label: 'Sleep', icon: 'moon' as const },
];

function confidenceLabel(sampleSize: number) {
  if (sampleSize >= 30) return { label: 'High', tone: 'success' as const };
  if (sampleSize >= 10) return { label: 'Medium', tone: 'warning' as const };
  if (sampleSize > 0) return { label: 'Low', tone: 'warning' as const };
  return { label: 'None yet', tone: 'muted' as const };
}

function interventionLabel(feedbackCount: number, ranked: number) {
  if (feedbackCount === 0) return { label: 'None yet', tone: 'muted' as const };
  if (ranked > 0) return { label: 'Learning', tone: 'success' as const };
  return { label: 'Trying', tone: 'warning' as const };
}

export default function Brain() {
  const { colors, spacing, typography } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const maximumPrivacy = profile?.privacyMode === 'maximum_privacy';
  const [checkinCount, setCheckinCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [voiceCount, setVoiceCount] = useState(0);
  const [insightCount, setInsightCount] = useState(0);
  const [experimentCount, setExperimentCount] = useState(0);
  const [healthDayCount, setHealthDayCount] = useState(0);
  const [sleepDayCount, setSleepDayCount] = useState(0);
  const [calendarDayCount, setCalendarDayCount] = useState(0);
  const [interventionFeedbackCount, setInterventionFeedbackCount] = useState(0);
  const [interventionRankedCount, setInterventionRankedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [manualSections, setManualSections] = useState<OperatingManualSection[]>([]);
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [manualEvidenceCount, setManualEvidenceCount] = useState(0);
  const [manualLoading, setManualLoading] = useState(true);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsMessage, setPatternsMessage] = useState<string | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(true);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [evidencePattern, setEvidencePattern] = useState<Pattern | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const evidenceRef = useRef<BottomSheetModal>(null);
  const manualEvidenceRef = useRef<BottomSheetModal>(null);
  const memoryEvidenceRef = useRef<BottomSheetModal>(null);

  const openMemoryTransparency = (m: MemoryItem) => {
    setSelectedMemory(m);
    memoryEvidenceRef.current?.present();
  };

  const openPatternEvidence = (p: Pattern) => {
    setEvidencePattern(p);
    evidenceRef.current?.present();
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = [Query.equal('userId', user.$id), Query.limit(1)];
      const [checkins, inbox, voice, insights, experiments, health, calendarDocs] = await Promise.all([
        databases.listDocuments(DB_ID, COLLECTIONS.checkins, q),
        databases.listDocuments(DB_ID, COLLECTIONS.mentalInbox, q),
        databases.listDocuments(DB_ID, COLLECTIONS.voiceReflections, q),
        databases.listDocuments(DB_ID, COLLECTIONS.insights, q),
        databases.listDocuments(DB_ID, COLLECTIONS.experiments, q),
        databases.listDocuments(DB_ID, COLLECTIONS.healthData, q),
        databases.listDocuments(DB_ID, COLLECTIONS.calendarSummaries, q),
      ]);
      setCheckinCount(checkins.total);
      setInboxCount(inbox.total);
      setVoiceCount(voice.total);
      setInsightCount(insights.total);
      setExperimentCount(experiments.total);
      setHealthDayCount(health.total);
      setCalendarDayCount(calendarDocs.total);

      const sleepDocs = await databases.listDocuments(DB_ID, COLLECTIONS.healthData, [
        Query.equal('userId', user.$id),
        Query.isNotNull('sleepMinutes'),
        Query.limit(1),
      ]);
      setSleepDayCount(sleepDocs.total);

      const interventionResults = await listInterventionResults(user.$id);
      const autopilot = computeAutopilotRanking(interventionResults);
      setInterventionFeedbackCount(interventionResults.filter((r: any) => r.userFeedback).length);
      setInterventionRankedCount(autopilot.ranked.length);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (maximumPrivacy) {
      setManualLoading(false);
      setManualSections([]);
      setManualMessage('Switched off by your privacy mode — no cross-source synthesis while Maximum privacy is on.');
      return;
    }
    setManualLoading(true);
    fetchOperatingManual()
      .then((result) => {
        if (result.manual) {
          setManualSections(result.manual.sections);
          setManualMessage(null);
          setManualEvidenceCount(result.manual.evidenceCount);
        } else {
          setManualSections([]);
          setManualMessage(result.message ?? result.error ?? null);
        }
      })
      .catch(() => setManualMessage(null))
      .finally(() => setManualLoading(false));
  }, [maximumPrivacy]);

  useEffect(() => {
    if (maximumPrivacy) {
      setPatternsLoading(false);
      setPatterns([]);
      setPatternsMessage('Switched off by your privacy mode — no cross-source synthesis while Maximum privacy is on.');
      return;
    }
    setPatternsLoading(true);
    fetchPatterns()
      .then((result) => {
        if (result.patterns && result.patterns.length > 0) {
          setPatterns(result.patterns);
          setPatternsMessage(null);
        } else {
          setPatterns([]);
          setPatternsMessage(result.message ?? result.error ?? null);
        }
      })
      .catch(() => setPatternsMessage(null))
      .finally(() => setPatternsLoading(false));
  }, [maximumPrivacy]);

  const loadMemories = useCallback(() => {
    if (maximumPrivacy) {
      setMemories([]);
      return;
    }
    listMemories(8)
      .then((result) => setMemories(result.memories ?? []))
      .catch(() => setMemories([]));
  }, [maximumPrivacy]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const graphNodes = [
    { key: 'checkins', label: 'Check-ins', count: checkinCount },
    { key: 'inbox', label: 'Mental inbox', count: inboxCount },
    { key: 'voice', label: 'Voice', count: voiceCount },
    { key: 'insights', label: 'Insights', count: insightCount },
    { key: 'experiments', label: 'Experiments', count: experimentCount },
    { key: 'health', label: 'Health data', count: healthDayCount },
    { key: 'calendar', label: 'Calendar', count: calendarDayCount },
  ];

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={[typography.display, { color: colors.textPrimary }]}>Your Brain</Text>
          <AIOrb size={16} state={loading || patternsLoading ? 'thinking' : patterns.length > 0 ? 'learning' : 'idle'} />
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
          How much I've actually learned about you — not a mental health score.
        </Text>

        {/* Bento row: hero count tile + confidence dimension tiles */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <GlassCard style={{ minHeight: 132, justifyContent: 'center' }}>
              <AnimatedNumber value={checkinCount} style={[typography.hero, { color: colors.primary, fontSize: 44 }]} />
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}>
                check-in{checkinCount === 1 ? '' : 's'} recorded
              </Text>
            </GlassCard>
          </View>
          <View style={{ flex: 1, gap: spacing.sm }}>
            {DIMENSIONS.slice(0, 2).map((d) => {
              const conf = confidenceLabel(d.key === 'mood' ? checkinCount : 0);
              const dotColor =
                conf.tone === 'success' ? colors.success : conf.tone === 'warning' ? colors.warning : colors.textMuted;
              return (
                <GlassCard key={d.key} style={{ paddingVertical: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Feather name={d.icon} size={16} color={colors.textSecondary} />
                    <Text style={[typography.caption, { color: colors.textPrimary }]}>{d.label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                    <Text style={[typography.micro, { color: colors.textSecondary }]}>{conf.label}</Text>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {DIMENSIONS.slice(2).map((d) => {
            // Focus and Recovery still have no real tracked source — honestly
            // "None yet". Sleep is real once Health Connect has synced days
            // with a sleep session.
            const conf = d.key === 'sleep' ? confidenceLabel(sleepDayCount) : { label: 'None yet', tone: 'muted' as const };
            const dotColor =
              conf.tone === 'success' ? colors.success : conf.tone === 'warning' ? colors.warning : colors.textMuted;
            return (
              <View key={d.key} style={{ flex: 1 }}>
                <GlassCard style={{ paddingVertical: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Feather name={d.icon} size={16} color={colors.textSecondary} />
                    <Text style={[typography.caption, { color: colors.textPrimary }]}>{d.label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                    <Text style={[typography.micro, { color: colors.textSecondary }]}>{conf.label}</Text>
                  </View>
                </GlassCard>
              </View>
            );
          })}
        </View>

        {(() => {
          const conf = interventionLabel(interventionFeedbackCount, interventionRankedCount);
          const dotColor =
            conf.tone === 'success' ? colors.success : conf.tone === 'warning' ? colors.warning : colors.textMuted;
          return (
            <GlassCard style={{ paddingVertical: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Feather name="zap" size={16} color={colors.textSecondary} />
                  <Text style={[typography.caption, { color: colors.textPrimary }]}>Interventions</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                  <Text style={[typography.micro, { color: colors.textSecondary }]}>{conf.label}</Text>
                </View>
              </View>
            </GlassCard>
          );
        })()}

        <GlassCard tint="accent">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
            <Feather name="share-2" size={16} color={colors.textPrimary} />
            <Text style={[typography.headline, { color: colors.textPrimary }]}>Your brain map</Text>
          </View>
          <PersonalGraph
            nodes={graphNodes}
            edges={patterns
              .map((p) => {
                const from = DIMENSION_TO_SOURCE[p.dimensionA];
                const to = DIMENSION_TO_SOURCE[p.dimensionB];
                if (!from || !to || from === to) return null;
                return {
                  from,
                  to,
                  relationshipType: p.relationshipType,
                  confidence: p.confidence,
                  onPress: () => openPatternEvidence(p),
                };
              })
              .filter((e): e is NonNullable<typeof e> => e !== null)}
          />
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            {patternsLoading
              ? 'Checking for real patterns…'
              : patterns.length > 0
                ? 'The moving line is a real connection I found — tap it to see the evidence.'
                : patternsMessage ??
                  'Appears once patterns emerge between things like sleep, meetings and mood. Nothing invented in the meantime.'}
          </Text>
          {patterns.length > 0 && (
            <PressableRow onPress={() => router.push('/counterfactual-lab')} style={{ gap: 4, marginTop: spacing.sm, justifyContent: 'center' }}>
              <Feather name="help-circle" size={13} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Ask "what if?"</Text>
            </PressableRow>
          )}
          <PressableRow onPress={() => router.push('/discoveries')} style={{ gap: 4, marginTop: spacing.xs, justifyContent: 'center' }}>
            <Feather name="star" size={13} color={colors.aiAccent} />
            <Text style={[typography.caption, { color: colors.aiAccent, fontWeight: '700' }]}>Discoveries</Text>
          </PressableRow>
          <PressableRow onPress={() => router.push('/future-me')} style={{ gap: 4, marginTop: spacing.xs, justifyContent: 'center' }}>
            <Feather name="fast-forward" size={13} color={colors.secondary} />
            <Text style={[typography.caption, { color: colors.secondary, fontWeight: '700' }]}>What usually happens?</Text>
          </PressableRow>
          <PressableRow
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/your-story');
            }}
            style={{ gap: 4, marginTop: spacing.xs, justifyContent: 'center' }}
            accessibilityLabel="Your story — a month-by-month journey"
          >
            <Feather name="book-open" size={13} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Your story</Text>
          </PressableRow>
        </GlassCard>

        <Text style={[typography.headline, { color: colors.textPrimary, marginTop: spacing.xs }]}>How I work</Text>

        {manualLoading || manualSections.length === 0 ? (
          <GlassCard>
            <Text style={[typography.insightQuote, { color: colors.textSecondary }]}>
              {manualLoading ? 'Checking what I actually know…' : manualMessage ?? 'Nothing here yet; it fills in as you use the app.'}
            </Text>
          </GlassCard>
        ) : (
          // Spec section 79 — named, separate cards ("I focus best", "What's
          // worked", "What I've noticed"), not one blended paragraph. Only
          // the sections with real evidence render; nothing is force-filled.
          manualSections.map((section) => (
            <OperatingManualCard
              key={section.key}
              icon={MANUAL_SECTION_ICON[section.key] ?? 'compass'}
              label={section.label}
              text={section.text}
            />
          ))
        )}

        {manualSections.length > 0 && (
          <PressableRow onPress={() => manualEvidenceRef.current?.present()} style={{ gap: 4 }}>
            <Feather name="help-circle" size={14} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary }]}>Why this?</Text>
          </PressableRow>
        )}

        {memories.length > 0 && (
          <GlassCard>
            <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.xs }]}>Memory</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              A running record of what I've actually learned — not a chat history. Tap one to see why it's remembered.
            </Text>
            {memories.map((m) => (
              <PressableRow key={m.id} onPress={() => openMemoryTransparency(m)} style={{ alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 6 }}>
                <Feather name={MEMORY_ICON[m.type]} size={14} color={colors[MEMORY_COLOR_KEY[m.type]]} style={{ marginTop: 3 }} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[typography.caption, { color: m.outdated ? colors.textMuted : colors.textPrimary, textDecorationLine: m.outdated ? 'line-through' : 'none' }]}
                  >
                    {m.content}
                  </Text>
                  <Text style={[typography.micro, { color: colors.textMuted, marginTop: 2 }]}>
                    {m.type} · {relativeTime(m.createdAt)}
                    {m.outdated ? ' · outdated' : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </PressableRow>
            ))}
          </GlassCard>
        )}
      </ScrollView>

      <MemoryTransparencySheet ref={memoryEvidenceRef} memory={selectedMemory} onChanged={loadMemories} />

      <EvidenceSheet
        ref={evidenceRef}
        title={
          evidencePattern
            ? `${DIMENSION_DISPLAY[evidencePattern.dimensionA] ?? evidencePattern.dimensionA} ↔ ${DIMENSION_DISPLAY[evidencePattern.dimensionB] ?? evidencePattern.dimensionB}`
            : ''
        }
        confidence={evidencePattern?.confidence}
        items={
          evidencePattern
            ? ([
                { kind: 'pattern', text: evidencePattern.description },
                { kind: 'observed', text: `Based on ${evidencePattern.evidenceCount} days where both were recorded.` },
              ] as EvidenceItem[])
            : []
        }
      />

      <EvidenceSheet
        ref={manualEvidenceRef}
        title="How I work"
        items={[
          { kind: 'pattern', text: `Built from ${manualEvidenceCount} real record${manualEvidenceCount === 1 ? '' : 's'} — check-in patterns, concluded experiments, and intervention feedback.` },
          {
            kind: 'inference',
            text: 'This is AI-phrased, but every sentence is constrained to reference only that evidence — it cannot cite a pattern or outcome that isn\'t actually in your history.',
          },
        ]}
      />
    </ScreenBackground>
  );
}
