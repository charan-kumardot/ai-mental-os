import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeProvider';
import { fetchWeeklyReview, WeeklyReviewResult } from '../src/lib/weeklyReview';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { AnimatedChart } from '../src/components/AnimatedChart';
import { AIOrb, OrbState } from '../src/components/AIOrb';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StatTile } from '../src/components/StatTile';
import { SkeletonCard } from '../src/components/Skeleton';

const { width } = Dimensions.get('window');

const MOOD_LABEL: Record<string, string> = {
  great: 'Great',
  good: 'Good',
  okay: 'Okay',
  low: 'Low',
  struggling: 'Struggling',
};

const TREND_COPY: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  up: { label: 'Trending higher than last week', icon: 'trending-up' },
  down: { label: 'Trending lower than last week', icon: 'trending-down' },
  flat: { label: 'About the same as last week', icon: 'minus' },
};

/** One full-bleed beat of the story — a page in the horizontal pager. */
function StoryPage({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ width, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

function PageDots({ count, active }: { count: number; active: number }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === active ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

export default function WeeklyReview() {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<WeeklyReviewResult | null>(null);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchWeeklyReview()
      .then(setResult)
      .finally(() => setLoading(false));
  }, []);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const review = result?.review;
  const pageOrbStates: OrbState[] = ['learning', 'insight', 'insight', 'success'];
  const pageCount = review ? (review.trendVsPriorWeek ? 4 : 3) : 0;

  return (
    <ScreenBackground>
      <ScreenHeader title="Your week" />

      {loading && (
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' }}>
          <GlassCard>
            <SkeletonCard lines={1} />
          </GlassCard>
          <GlassCard>
            <SkeletonCard lines={3} />
          </GlassCard>
        </View>
      )}

      {!loading && result?.skipped && (
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center' }}>
          <GlassCard>
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <AIOrb size={48} state="idle" />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
                Not quite enough yet
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs, textAlign: 'center', maxWidth: 280 }]}>
                {result.message}
              </Text>
            </View>
          </GlassCard>
          <SecondaryButton label="Back home" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: spacing.lg }} />
        </View>
      )}

      {!loading && result?.error && (
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center' }}>
          <GlassCard>
            <Text style={[typography.body, { color: colors.textPrimary, textAlign: 'center' }]}>{result.error}</Text>
          </GlassCard>
        </View>
      )}

      {!loading && review && (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <PageDots count={pageCount} active={page} />

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
          >
            {/* Beat 1: title */}
            <StoryPage>
              <AIOrb size={56} state={pageOrbStates[0]} />
              <Text style={[typography.hero, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }]}>
                Your week
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
                Swipe through what actually happened — grounded in your own check-ins, nothing invented.
              </Text>
            </StoryPage>

            {/* Beat 2: the numbers */}
            <StoryPage>
              <Text style={[typography.headline, { color: colors.textPrimary, marginBottom: spacing.lg }]}>By the numbers</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <StatTile label="CHECK-INS" value={review.checkinCount} tone="neutral" />
                <StatTile label="MOST COMMON MOOD" value={MOOD_LABEL[review.mostCommonMood] ?? review.mostCommonMood} tone="neutral" />
              </View>
            </StoryPage>

            {/* Beat 3 (optional): trend */}
            {review.trendVsPriorWeek && (
              <StoryPage>
                <Feather
                  name={TREND_COPY[review.trendVsPriorWeek].icon}
                  size={40}
                  color={review.trendVsPriorWeek === 'down' ? colors.warning : colors.success}
                />
                <Text style={[typography.title, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md }]}>
                  {TREND_COPY[review.trendVsPriorWeek].label}
                </Text>
                {review.dailyMoodSeries.length >= 2 && (
                  <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                    <AnimatedChart
                      points={review.dailyMoodSeries.map((p) => ({ label: p.date, value: p.value }))}
                      color={review.trendVsPriorWeek === 'down' ? colors.warning : colors.success}
                    />
                    <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.xs }]}>
                      Mood by day this week — only real check-in days, nothing filled in
                    </Text>
                  </View>
                )}
              </StoryPage>
            )}

            {/* Beat 4: narrative + close */}
            <StoryPage>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>What this week looked like</Text>
              <Text style={[typography.insightQuote, { color: colors.textPrimary, textAlign: 'center' }]}>
                "{review.narrative}"
              </Text>
              <SecondaryButton label="Back home" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: spacing.xl, width: 200 }} />
            </StoryPage>
          </ScrollView>
        </View>
      )}
    </ScreenBackground>
  );
}
