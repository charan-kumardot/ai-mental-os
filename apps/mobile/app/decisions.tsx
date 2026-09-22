import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAuth } from '../src/lib/auth-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { databases, DB_ID, COLLECTIONS, ID, Query, Permission, Role } from '../src/lib/appwrite';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { TextField } from '../src/components/TextField';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { Feather } from '@expo/vector-icons';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SwipeableRow } from '../src/components/SwipeableRow';
import { staggerEntering } from '../src/lib/entrance';
import { simulateDecision } from '../src/lib/decisionSimulator';

/**
 * Decision Debt (spec section 29) — organizes an unresolved decision into
 * known/unknown/options/next-action. Deliberately does NOT make the
 * decision for the user (spec: "Do not make major life decisions for
 * users") — it only structures what they've already told it.
 */
export default function Decisions() {
  const { colors, spacing, typography, reduceMotion } = useTheme();
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [known, setKnown] = useState('');
  const [unknown, setUnknown] = useState('');
  const [options, setOptions] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [simulating, setSimulating] = useState<string | null>(null);
  const [explorations, setExplorations] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.decisions, [
      Query.equal('userId', user.$id),
      Query.orderDesc('$createdAt'),
    ]);
    setDecisions(res.documents);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setTitle('');
    setKnown('');
    setUnknown('');
    setOptions('');
    setNextAction('');
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      await databases.createDocument(
        DB_ID,
        COLLECTIONS.decisions,
        ID.unique(),
        {
          userId: user.$id,
          title: title.trim(),
          knownInfo: known.trim() || undefined,
          unknownInfo: unknown.trim() || undefined,
          options: options.trim() || undefined,
          nextAction: nextAction.trim() || undefined,
          resolved: false,
        },
        [Permission.read(Role.user(user.$id)), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id))]
      );
      reset();
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleExplore = async (d: any) => {
    if (!d.options) return;
    setSimulating(d.$id);
    try {
      const result = await simulateDecision(d.$id);
      setExplorations((prev) => ({ ...prev, [d.$id]: result.exploration ?? "Couldn't explore that right now." }));
    } finally {
      setSimulating(null);
    }
  };

  const toggleResolved = async (d: any) => {
    const updated = await databases.updateDocument(DB_ID, COLLECTIONS.decisions, d.$id, { resolved: !d.resolved });
    setDecisions((prev) => prev.map((x) => (x.$id === d.$id ? updated : x)));
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <ScreenHeader title="Decisions" orbState={decisions.length > 0 ? 'learning' : 'idle'} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          I'll help organize what you know — I won't decide for you.
        </Text>

        {showForm ? (
          <GlassCard>
            <TextField label="What's the decision?" value={title} onChangeText={setTitle} multiline />
            <TextField label="What you know" value={known} onChangeText={setKnown} multiline />
            <TextField label="What you don't know" value={unknown} onChangeText={setUnknown} multiline />
            <TextField label="Options" value={options} onChangeText={setOptions} multiline />
            <TextField label="Smallest next step" value={nextAction} onChangeText={setNextAction} multiline />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <PrimaryButton label="Save" onPress={handleCreate} loading={creating} disabled={!title.trim()} style={{ flex: 1 }} />
              <SecondaryButton label="Cancel" onPress={reset} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        ) : (
          <PrimaryButton label="Add a decision" onPress={() => setShowForm(true)} />
        )}

        {decisions.length === 0 ? (
          <GlassCard>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
              Nothing unresolved logged yet.
            </Text>
          </GlassCard>
        ) : (
          decisions.map((d, i) => (
            <Animated.View key={d.$id} entering={staggerEntering(i, reduceMotion, 60)}>
            <SwipeableRow resolved={!!d.resolved} onResolve={() => toggleResolved(d)}>
              <GlassCard style={{ opacity: d.resolved ? 0.55 : 1 }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                  <Feather
                    name={d.resolved ? 'check-circle' : 'circle'}
                    size={20}
                    color={d.resolved ? colors.success : colors.textMuted}
                    onPress={() => toggleResolved(d)}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.bodyMedium,
                        { color: colors.textPrimary, textDecorationLine: d.resolved ? 'line-through' : 'none' },
                      ]}
                    >
                      {d.title}
                    </Text>
                    {d.knownInfo && (
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                        Known: {d.knownInfo}
                      </Text>
                    )}
                    {d.unknownInfo && (
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        Unknown: {d.unknownInfo}
                      </Text>
                    )}
                    {d.options && (
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        Options: {d.options}
                      </Text>
                    )}
                    {d.nextAction && (
                      <Text style={[typography.caption, { color: colors.primary, marginTop: spacing.xs }]}>
                        Next: {d.nextAction}
                      </Text>
                    )}
                    {d.options && !explorations[d.$id] && (
                      <SecondaryButton
                        label="Explore scenarios"
                        onPress={() => handleExplore(d)}
                        loading={simulating === d.$id}
                        style={{ marginTop: spacing.sm }}
                      />
                    )}
                    {explorations[d.$id] && (
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                        {explorations[d.$id]}
                      </Text>
                    )}
                  </View>
                </View>
              </GlassCard>
            </SwipeableRow>
            </Animated.View>
          ))
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
