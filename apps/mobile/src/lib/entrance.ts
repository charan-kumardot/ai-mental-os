import { FadeInUp } from 'react-native-reanimated';

/**
 * Shared staggered entrance animation for card/tile lists (§73/§106 —
 * centralized motion, not scattered arbitrary values). Returns undefined
 * when Reduce Motion is on so content simply appears, per §104.
 */
export function staggerEntering(index: number, reduceMotion: boolean, staggerMs: number) {
  if (reduceMotion) return undefined;
  return FadeInUp.delay(index * staggerMs).springify().damping(18).stiffness(180);
}
