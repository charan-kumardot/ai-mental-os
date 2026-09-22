import { StateLevel } from './stateEngine';
import { MoodValue } from '../components/MoodSelector';

export type WeatherState = 'clear' | 'changing' | 'heavy' | 'drained' | 'recovering' | 'renewing';

export interface Weather {
  state: WeatherState;
  icon: string;
  label: string;
}

const WEATHER_META: Record<WeatherState, { icon: string; label: string }> = {
  clear: { icon: '☀', label: 'Clear' },
  changing: { icon: '🌤', label: 'Changing' },
  heavy: { icon: '☁', label: 'Heavy' },
  drained: { icon: '🌧', label: 'Drained' },
  recovering: { icon: '🌙', label: 'Recovering' },
  renewing: { icon: '🌱', label: 'Renewing' },
};

/**
 * Emotional Weather (spec §8) — replaces a mood-score-first read with an
 * atmospheric one, built entirely from signals the app already tracks for
 * real (mood, energy, recovery, mental load). A deterministic decision
 * tree, not a model's guess, and explicitly never framed as a diagnosis —
 * callers should always pair this with the real factor(s) behind it
 * (e.g. the existing briefing rows), never show the weather alone as if
 * it explained itself.
 */
export function computeEmotionalWeather(input: {
  lastMood?: MoodValue;
  energy?: StateLevel | null;
  recovery?: StateLevel | null;
  mentalLoad?: StateLevel | null;
}): Weather | null {
  const { lastMood, energy, recovery, mentalLoad } = input;
  if (!lastMood && !energy && !recovery && !mentalLoad) return null;

  let state: WeatherState;
  if (mentalLoad === 'high') {
    state = 'heavy';
  } else if (energy === 'low' && recovery === 'low') {
    state = 'drained';
  } else if (recovery === 'low') {
    state = 'recovering';
  } else if (recovery === 'high' && (lastMood === 'good' || lastMood === 'great')) {
    state = 'renewing';
  } else if (lastMood === 'good' || lastMood === 'great' || energy === 'high') {
    state = 'clear';
  } else {
    state = 'changing';
  }

  return { state, ...WEATHER_META[state] };
}
