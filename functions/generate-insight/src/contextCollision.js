/**
 * Spec section 34, "Context Collision Detector" — pure, deterministic, no
 * AI: when multiple real load factors are true at the same time (poor
 * recovery + low energy + heavy mental load), the spec explicitly says not
 * to send several separate notifications for each one, but to combine them
 * into a single "today contains several load factors at once" read. This
 * only ever looks at levels the state engine has already computed for real
 * — it never invents a factor that wasn't actually estimated.
 */
function detectContextCollision(state) {
  if (!state) return { collided: false, factors: [] };

  const factors = [];
  if (state.energy === 'low') factors.push('low energy');
  if (state.recovery === 'low') factors.push('light recovery');
  if (state.mentalLoad === 'high') factors.push('a heavy mental load');

  if (factors.length < 2) return { collided: false, factors: [] };

  return {
    collided: true,
    factors,
    message: 'Today contains several load factors at once.',
  };
}

module.exports = { detectContextCollision };
