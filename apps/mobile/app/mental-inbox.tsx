import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme/ThemeProvider';
import { useAuth } from '../src/lib/auth-context';
import { submitToMentalInbox, listMentalInbox } from '../src/lib/mentalInbox';
import { databases, DB_ID, COLLECTIONS, ID, Permission, Role } from '../src/lib/appwrite';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { TextField } from '../src/components/TextField';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { AIOrb, OrbState } from '../src/components/AIOrb';
import { SwipeableRow } from '../src/components/SwipeableRow';
import { detectRumination } from '../src/lib/rumination';
import { recordNeedChoice, getDominantNeedChoice, NeedChoice } from '../src/lib/interactionPreference';
import { reflectOnEntry } from '../src/lib/listening';

const CATEGORY_LABEL: Record<string, string> = {
  action: 'Something to do',
  decision: 'A decision',
  information: 'Worth remembering',
  conversation: 'A conversation to have',
  emotional: 'Something you felt',
  defer: 'Not now',
  not_actionable: 'Just noted',
};

export default function MentalInbox() {
  const { colors, spacing, typography } = useTheme();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [safetyResponse, setSafetyResponse] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  // Micro-Action Generator (spec §37) — a real overwhelm signal (the
  // 'emotional' category, or a long unstructured dump) gets ONE narrowing
  // question instead of a 12-step plan: "what's the one thing bothering you
  // most right now?" The answer is saved as its own tiny, actionable item.
  const [microActionPrompt, setMicroActionPrompt] = useState(false);
  const [microActionAnswer, setMicroActionAnswer] = useState('');
  const [savingMicroAction, setSavingMicroAction] = useState(false);
  const [ruminationDismissed, setRuminationDismissed] = useState(false);
  const [ruminationBusy, setRuminationBusy] = useState(false);
  // "What do you need from me?" (spec §1) + Listening Mode (spec §2) — an
  // 'emotional' category entry is the same real overwhelm signal that used
  // to only ever trigger the micro-action prompt; now it first asks what
  // kind of help is actually wanted, since "help me solve it" and "just
  // listen" call for genuinely different responses, not one generic flow.
  const [needChooserPrompt, setNeedChooserPrompt] = useState(false);
  const [needChooserContent, setNeedChooserContent] = useState('');
  const [listeningReflection, setListeningReflection] = useState<string | null>(null);
  const [listeningBusy, setListeningBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const docs = await listMentalInbox(user.$id);
    setItems(docs);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleResolved = async (item: any) => {
    const updated = await databases.updateDocument(DB_ID, COLLECTIONS.mentalInbox, item.$id, {
      resolved: !item.resolved,
    });
    setItems((prev) => prev.map((i) => (i.$id === item.$id ? updated : i)));
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;
    setSubmitting(true);
    setOrbState('thinking');
    setSafetyResponse(null);
    try {
      const result = await submitToMentalInbox(content.trim());
      if (result.flagged) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setOrbState('uncertainty');
        setSafetyResponse(result.response ?? null);
        setContent('');
      } else if (result.item) {
        setOrbState('success');
        const submittedContent = content.trim();
        const isEmotional = result.item.category === 'emotional';
        const wasOverwhelmed = isEmotional || submittedContent.length > 140;
        setContent('');
        await load();
        setTimeout(async () => {
          setOrbState('idle');
          if (isEmotional) {
            const dominant = await getDominantNeedChoice();
            if (dominant) {
              handleNeedChoice(dominant, submittedContent, true);
            } else {
              setNeedChooserContent(submittedContent);
              setNeedChooserPrompt(true);
            }
          } else if (wasOverwhelmed) setMicroActionPrompt(true);
        }, 1200);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNeedChoice = async (choice: NeedChoice, entryContent: string, autoApplied = false) => {
    recordNeedChoice(choice).catch(() => {});
    setNeedChooserPrompt(false);
    if (!autoApplied) Haptics.selectionAsync().catch(() => {});

    switch (choice) {
      case 'listen':
        setListeningBusy(true);
        try {
          const result = await reflectOnEntry(entryContent);
          setListeningReflection(result.reflection ?? "I hear you — that sounds like a lot to carry.");
        } catch {
          setListeningReflection("I hear you — that sounds like a lot to carry.");
        } finally {
          setListeningBusy(false);
        }
        break;
      case 'understand':
        router.push('/emotional-first-aid?flow=overthinking');
        break;
      case 'solve':
        router.push('/interventions');
        break;
      case 'decide':
        router.push('/decisions');
        break;
      case 'calm':
        router.push('/emotional-first-aid?flow=panic');
        break;
      case 'next_step':
        router.push('/emotional-first-aid?flow=overload');
        break;
      case 'said_it':
        // Nothing more to do — the entry is already saved.
        break;
    }
  };

  const handleSaveMicroAction = async () => {
    if (!user || !microActionAnswer.trim()) {
      setMicroActionPrompt(false);
      return;
    }
    setSavingMicroAction(true);
    try {
      await databases.createDocument(
        DB_ID,
        COLLECTIONS.mentalInbox,
        ID.unique(),
        { userId: user.$id, content: microActionAnswer.trim(), category: 'action' },
        [Permission.read(Role.user(user.$id)), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id))]
      );
      setMicroActionAnswer('');
      setMicroActionPrompt(false);
      await load();
    } finally {
      setSavingMicroAction(false);
    }
  };

  const ruminating = !ruminationDismissed && detectRumination(items);
  const ruminationEntries = items.filter((i) => i.category === 'emotional' && !i.resolved);

  const handlePutItDown = async () => {
    setRuminationBusy(true);
    try {
      await Promise.all(
        ruminationEntries.map((i) => databases.updateDocument(DB_ID, COLLECTIONS.mentalInbox, i.$id, { resolved: true }))
      );
      setRuminationDismissed(true);
      await load();
    } finally {
      setRuminationBusy(false);
    }
  };

  // Safety response takes over the whole screen — minimal, no distractions,
  // per "the worse the user feels, the less the app should ask of them."
  if (safetyResponse) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <AIOrb state="uncertainty" size={72} />
          <Text
            style={[typography.body, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.xl, maxWidth: 320 }]}
          >
            {safetyResponse}
          </Text>
          <PrimaryButton
            label="Back home"
            onPress={() => {
              setSafetyResponse(null);
              router.replace('/(tabs)/home');
            }}
            style={{ marginTop: spacing.xl, width: 200 }}
          />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
          hitSlop={12}
          style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
          <AIOrb state={orbState} size={56} />
          <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
            Get it off your mind
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxs, maxWidth: 300 }]}
          >
            Dump a thought here. I'll sort it — nothing needs to be organized in your head first.
          </Text>
        </View>

        <GlassCard>
          <TextField
            placeholder="What's on your mind?"
            value={content}
            onChangeText={setContent}
            multiline
            style={{ minHeight: 80 }}
          />
          <PrimaryButton label="Add" onPress={handleSubmit} loading={submitting} disabled={!content.trim()} />
        </GlassCard>

        {needChooserPrompt && (
          <GlassCard tint="accent">
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              What do you need right now?
            </Text>
            <View style={{ gap: spacing.xs }}>
              <SecondaryButton label="🫂 Just listen" onPress={() => handleNeedChoice('listen', needChooserContent)} />
              <SecondaryButton label="🧠 Help me understand" onPress={() => handleNeedChoice('understand', needChooserContent)} />
              <SecondaryButton label="🛠 Help me solve it" onPress={() => handleNeedChoice('solve', needChooserContent)} />
              <SecondaryButton label="🧭 Help me decide" onPress={() => handleNeedChoice('decide', needChooserContent)} />
              <SecondaryButton label="🌿 Help me calm down" onPress={() => handleNeedChoice('calm', needChooserContent)} />
              <SecondaryButton label="🚶 Help me take the next step" onPress={() => handleNeedChoice('next_step', needChooserContent)} />
              <SecondaryButton label="😶 I just needed to say it" onPress={() => handleNeedChoice('said_it', needChooserContent)} />
            </View>
          </GlassCard>
        )}

        {listeningBusy && (
          <GlassCard>
            <AIOrb state="thinking" size={40} />
          </GlassCard>
        )}

        {listeningReflection && (
          <GlassCard tint="accent">
            <Text style={[typography.insightQuote, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              {listeningReflection}
            </Text>
            <SecondaryButton label="Got it" onPress={() => setListeningReflection(null)} />
          </GlassCard>
        )}

        {microActionPrompt && (
          <GlassCard tint="accent">
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              That's a lot.
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Let's remove just one thing from your head. What's bothering you most right now?
            </Text>
            <TextField
              placeholder="One thing…"
              value={microActionAnswer}
              onChangeText={setMicroActionAnswer}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <PrimaryButton
                label="Got it"
                onPress={handleSaveMicroAction}
                loading={savingMicroAction}
                disabled={!microActionAnswer.trim()}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                label="Skip"
                onPress={() => {
                  setMicroActionPrompt(false);
                  setMicroActionAnswer('');
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        )}

        {ruminating && (
          <GlassCard>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              We've returned to this a few times
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Thinking about it again doesn't seem to be giving you much new information.
            </Text>
            <View style={{ gap: spacing.xs }}>
              <SecondaryButton label="Take one action" onPress={() => router.push('/emotional-first-aid?flow=overthinking')} />
              <SecondaryButton label="Talk it through" onPress={() => router.push('/voice-reflection')} />
              <SecondaryButton label="Put it down for now" onPress={handlePutItDown} loading={ruminationBusy} />
              <SecondaryButton label="Accept the uncertainty" onPress={() => setRuminationDismissed(true)} />
            </View>
          </GlassCard>
        )}

        {items.map((item) => (
          <SwipeableRow key={item.$id} resolved={!!item.resolved} onResolve={() => toggleResolved(item)}>
            <GlassCard style={{ opacity: item.resolved ? 0.55 : 1 }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                <Feather
                  name={item.resolved ? 'check-circle' : 'circle'}
                  size={20}
                  color={item.resolved ? colors.success : colors.textMuted}
                  onPress={() => toggleResolved(item)}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.body,
                      {
                        color: colors.textPrimary,
                        textDecorationLine: item.resolved ? 'line-through' : 'none',
                      },
                    ]}
                  >
                    {item.content}
                  </Text>
                  <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    {CATEGORY_LABEL[item.category] ?? item.category}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </SwipeableRow>
        ))}
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
