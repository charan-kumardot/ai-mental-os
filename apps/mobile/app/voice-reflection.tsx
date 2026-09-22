import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import { useTheme } from '../src/theme/ThemeProvider';
import { processVoiceRecording, saveVoiceReflection } from '../src/lib/voiceReflection';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SecondaryButton } from '../src/components/SecondaryButton';
import { TextField } from '../src/components/TextField';
import { AIOrb, OrbState } from '../src/components/AIOrb';
import { VoiceRecorder } from '../src/components/VoiceRecorder';

type Screen = 'idle' | 'recording' | 'processing' | 'confirm' | 'safety' | 'saved' | 'error';

export default function VoiceReflection() {
  const { colors, spacing, typography } = useTheme();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  // Polled at 80ms — fast enough to read as "live" without hammering the
  // native bridge. `metering` is in dBFS (roughly -60 silence to 0 max);
  // normalized below into the 0–1 range Waveform expects.
  const recorderState = useAudioRecorderState(recorder, 80);
  const micLevel =
    typeof recorderState.metering === 'number'
      ? Math.max(0, Math.min(1, (recorderState.metering + 50) / 50))
      : undefined;
  const [screen, setScreen] = useState<Screen>('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [meta, setMeta] = useState<{ intent?: string; event?: string | null; emotion?: string | null; concern?: string | null }>({});
  const [safetyMessage, setSafetyMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg('Microphone permission is needed for voice reflections.');
        setScreen('error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    setSeconds(0);
    await recorder.prepareToRecordAsync();
    recorder.record();
    setScreen('recording');
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setScreen('processing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording captured.');
      const result = await processVoiceRecording(uri);
      if (result.error) {
        setErrorMsg(result.error);
        setScreen('error');
      } else if (result.flagged) {
        // A distinct, gentler haptic for the safety path — not the same
        // buzz as a success or a routine tap.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSafetyMessage(result.response ?? null);
        setScreen('safety');
      } else {
        setTranscript(result.transcript ?? '');
        setMeta({ intent: result.intent, event: result.event, emotion: result.emotion, concern: result.concern });
        setScreen('confirm');
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Something went wrong processing that recording.');
      setScreen('error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveVoiceReflection({ transcript, ...meta });
      setScreen('saved');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Could not save that reflection.');
      setScreen('error');
    } finally {
      setSaving(false);
    }
  };

  const orbStateFor: Record<Screen, OrbState> = {
    idle: 'idle',
    recording: 'listening',
    processing: 'thinking',
    confirm: 'idle',
    safety: 'uncertainty',
    saved: 'success',
    error: 'uncertainty',
  };

  if (screen === 'safety') {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <AIOrb state="uncertainty" size={72} />
          <Text style={[typography.body, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.xl, maxWidth: 320 }]}>
            {safetyMessage}
          </Text>
          <PrimaryButton label="Back home" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: spacing.xl, width: 200 }} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, gap: spacing.md }}>
        {(screen === 'idle' || screen === 'confirm' || screen === 'error') && (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            hitSlop={12}
            style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name="arrow-left" size={20} color={colors.textPrimary} />
          </Pressable>
        )}
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          {(screen === 'idle' || screen === 'recording') ? (
            <VoiceRecorder
              recording={screen === 'recording'}
              seconds={seconds}
              micLevel={screen === 'recording' ? micLevel : undefined}
              onStart={startRecording}
              onStop={stopRecording}
            />
          ) : (
            <AIOrb state={orbStateFor[screen]} size={80} />
          )}

          {screen === 'processing' && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.lg }]}>
              Transcribing…
            </Text>
          )}

          {screen === 'error' && (
            <>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center', maxWidth: 300 }]}>
                {errorMsg}
              </Text>
              <PrimaryButton label="Try again" onPress={() => setScreen('idle')} style={{ marginTop: spacing.xl, width: 180 }} />
            </>
          )}

          {screen === 'saved' && (
            <>
              <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
                Saved
              </Text>
              <PrimaryButton label="Back home" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: spacing.xl, width: 200 }} />
            </>
          )}
        </View>

        {screen === 'confirm' && (
          <GlassCard>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>I heard</Text>
            {editing ? (
              <TextField value={transcript} onChangeText={setTranscript} multiline style={{ minHeight: 90 }} />
            ) : (
              <Text style={[typography.body, { color: colors.textPrimary, fontStyle: 'italic' }]}>"{transcript}"</Text>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <PrimaryButton label="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
              <SecondaryButton
                label={editing ? 'Done editing' : 'Edit'}
                onPress={() => setEditing((e) => !e)}
                style={{ flex: 1 }}
              />
            </View>
            <SecondaryButton
              label="Don't save"
              onPress={() => router.replace('/(tabs)/home')}
              style={{ marginTop: spacing.sm }}
            />
          </GlassCard>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
