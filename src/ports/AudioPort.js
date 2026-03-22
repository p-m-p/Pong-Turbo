/**
 * @typedef {Object} AudioPort
 * @property {(name: 'paddle'|'ghost'|'roundEnd'|'levelUp') => void} play
 */
export function assertAudioPort(adapter) {
  if (typeof adapter.play !== 'function')
    throw new Error('AudioPort: missing play(name)');
}
