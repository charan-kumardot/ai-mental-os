/**
 * Adaptive AI Communication (spec §36) — shared instruction-building so
 * every AI-generating function in this file respects the same explicit
 * user-set length/tone preference consistently, instead of each function
 * defining its own copy (previously only whatHappened.js honored this).
 */
function communicationInstruction(style) {
  const length = style?.length === 'detailed' ? 'Up to 2-3 sentences is fine.' : 'Keep it short — 1-2 sentences.';
  const tone = style?.tone === 'direct' ? 'Be direct and plain.' : 'Be warm and gentle.';
  return `${length} ${tone}`;
}

module.exports = { communicationInstruction };
