import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { AIOrb } from './AIOrb';
import { Waveform } from './Waveform';
import { PrimaryButton } from './PrimaryButton';

/**
 * Spec §105's VoiceRecorder — the idle/recording half of the voice
 * reflection flow (orb, prompt, live timer, mic-reactive waveform, the
 * start/stop control), extracted so it's a reusable unit rather than
 * inline JSX tied to one screen's state machine. Processing/confirm/
 * saved/error/safety stay in the screen since those aren't "recording."
 */
export function VoiceRecorder({
  recording,
  seconds,
  micLevel,
  onStart,
  onStop,
}: {
  recording: boolean;
  seconds: number;
  micLevel?: number;
  onStart: () => void;
  onStop: () => void;
}) {
  const { colors, spacing, typography } = useTheme();

  if (recording) {
    return (
      <>
        <AIOrb state="listening" size={80} />
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.lg }]}>Listening…</Text>
        <Text style={[typography.hero, { color: colors.textPrimary, fontSize: 32, marginTop: spacing.xs }]}>
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </Text>
        <Waveform active level={micLevel} />
        <PrimaryButton label="Stop" onPress={onStop} style={{ marginTop: spacing.md, width: 160 }} />
      </>
    );
  }

  return (
    <>
      <AIOrb state="idle" size={80} />
      <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
        Say what's on your mind
      </Text>
      <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, maxWidth: 280 }]}>
        Talk it out. I'll transcribe it and you decide what happens next.
      </Text>
      <PrimaryButton label="Start recording" onPress={onStart} style={{ marginTop: spacing.xl, width: 220 }} />
    </>
  );
}
