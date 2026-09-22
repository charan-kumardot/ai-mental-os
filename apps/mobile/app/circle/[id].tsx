import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/auth-context';
import { useProfile } from '../../src/lib/profile-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { GlassCard } from '../../src/components/GlassCard';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { AIOrb } from '../../src/components/AIOrb';
import { LivePulseDot } from '../../src/components/LivePulseDot';
import {
  CircleMessage,
  joinCircle,
  leaveCircle,
  isCircleMember,
  countCircleMembers,
  sendCircleMessage,
  listCircleMessages,
  subscribeToCircleMessages,
  blockUser,
  reportMessage,
  listBlockedUserIds,
  listHiddenMessageIds,
} from '../../src/lib/circles';
import { facilitateCircle } from '../../src/lib/circleFacilitator';

/** Real-Time Circle Chat (spec §47) + Circle AI (spec §46). */
export default function CircleDetail() {
  const { colors, spacing, typography, reduceMotion } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [member, setMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [messages, setMessages] = useState<CircleMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [facilitating, setFacilitating] = useState(false);
  const [safetyResponse, setSafetyResponse] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  const displayName = profile?.name || user?.name || 'Someone';

  const load = useCallback(async () => {
    if (!user || !id) return;
    const [isMember, count, msgs, blocked] = await Promise.all([
      isCircleMember(id, user.$id),
      countCircleMembers(id),
      listCircleMessages(id),
      listBlockedUserIds(id, user.$id),
    ]);
    setMember(isMember);
    setMemberCount(count);
    setMessages(msgs);
    setBlockedIds(blocked);
    listHiddenMessageIds(id, msgs.map((m) => m.$id)).then(setHiddenIds);
  }, [user, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToCircleMessages(id, (msg) => {
      setMessages((prev) => (prev.some((m) => m.$id === msg.$id) ? prev : [...prev, msg]));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub();
  }, [id]);

  const handleJoin = async () => {
    if (!user || !id) return;
    await joinCircle(id, user.$id, displayName);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await load();
  };

  const handleLeave = async () => {
    if (!user || !id) return;
    await leaveCircle(id, user.$id);
    router.back();
  };

  const handleSend = async () => {
    if (!user || !id || !draft.trim()) return;
    setSending(true);
    try {
      const result = await sendCircleMessage(id, displayName, draft.trim());
      if (result.flagged) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSafetyResponse(result.response ?? "I want to make sure you're safe — please reach out to someone who can help right now.");
      }
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const handleBlock = async (targetUserId: string, targetDisplayName?: string) => {
    if (!user || !id) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    await blockUser(id, user.$id, targetUserId);
    setBlockedIds((prev) => new Set(prev).add(targetUserId));
  };

  const handleReport = async (messageId: string) => {
    if (!user || !id) return;
    Haptics.selectionAsync().catch(() => {});
    setReportedIds((prev) => new Set(prev).add(messageId));
    const result = await reportMessage(id, user.$id, messageId);
    if (result.hidden) setHiddenIds((prev) => new Set(prev).add(messageId));
  };

  const handleFacilitate = async () => {
    if (!id) return;
    setFacilitating(true);
    try {
      await facilitateCircle(id);
    } finally {
      setFacilitating(false);
    }
  };

  if (safetyResponse) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <AIOrb state="uncertainty" size={72} />
          <Text style={[typography.body, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.xl, maxWidth: 320 }]}>
            {safetyResponse}
          </Text>
          <PrimaryButton label="Back to circle" onPress={() => setSafetyResponse(null)} style={{ marginTop: spacing.xl, width: 220 }} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    // Bottom edge must be safe-area protected here — this screen's own
    // "Leave circle"/Send row sits at the raw screen bottom (no tab bar to
    // reserve that space, unlike the tabbed screens), which the device's
    // gesture-nav strip would otherwise clip into, same class of bug as the
    // tab bar's own previously-fixed safe-area issue.
    <ScreenBackground edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
          <ScreenHeader title={`${memberCount} member${memberCount === 1 ? '' : 's'}`} />
          {member && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -spacing.sm, marginBottom: spacing.xs }}>
              <LivePulseDot color={colors.success} />
              <Text style={[typography.micro, { color: colors.textMuted }]}>Live</Text>
            </View>
          )}
        </View>

        {!member ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
            <PrimaryButton label="Join this circle" onPress={handleJoin} style={{ width: 220 }} />
          </View>
        ) : (
          <>
            <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }} style={{ flex: 1 }}>
              {(() => {
                const visible = messages.filter((m) => !blockedIds.has(m.userId) && !hiddenIds.has(m.$id));
                if (visible.length === 0) {
                  return (
                    <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
                      Nothing here yet — say something.
                    </Text>
                  );
                }
                return visible.map((m) => {
                  const isOwn = m.userId === user?.$id;
                  const isAi = m.kind === 'ai_facilitator';
                  return (
                    <Animated.View
                      key={m.$id}
                      entering={reduceMotion ? undefined : FadeInDown.duration(280).springify().damping(18)}
                      style={{ alignItems: isAi ? 'center' : isOwn ? 'flex-end' : 'flex-start' }}
                    >
                      <GlassCard compact tint={isAi ? 'accent' : isOwn ? 'primary' : 'none'} style={{ maxWidth: isAi ? '92%' : '80%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[typography.micro, { color: colors.textMuted, marginBottom: 2 }]}>
                            {isAi ? '✨ Circle AI' : isOwn ? 'You' : m.displayName || 'Someone'}
                          </Text>
                          {!isOwn && !isAi && (
                            <View style={{ flexDirection: 'row', gap: spacing.md }}>
                              <Pressable
                                onPress={reportedIds.has(m.$id) ? undefined : () => handleReport(m.$id)}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel={reportedIds.has(m.$id) ? 'Message reported' : 'Report this message'}
                              >
                                <Feather name="flag" size={14} color={reportedIds.has(m.$id) ? colors.textMuted : colors.textSecondary} />
                              </Pressable>
                              <Pressable
                                onPress={() => handleBlock(m.userId, m.displayName)}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel={`Block ${m.displayName || 'this member'}`}
                              >
                                <Feather name="user-x" size={14} color={colors.textSecondary} />
                              </Pressable>
                            </View>
                          )}
                        </View>
                        <Text style={[typography.caption, { color: colors.textPrimary }]}>{m.content}</Text>
                      </GlassCard>
                    </Animated.View>
                  );
                });
              })()}
            </ScrollView>

            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <SecondaryButton label="✨ Ask Circle AI" onPress={handleFacilitate} loading={facilitating} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <TextField placeholder="Say something…" value={draft} onChangeText={setDraft} />
                </View>
                <PrimaryButton label="Send" onPress={handleSend} loading={sending} disabled={!draft.trim()} accessibilityLabel="Send message" />
              </View>
              <SecondaryButton label="Leave circle" onPress={handleLeave} />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
