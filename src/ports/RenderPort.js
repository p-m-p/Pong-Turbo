/**
 * @typedef {Object} RenderPort
 * @property {(state: import('../domain/GameState.js').GameState) => void} drawFrame
 */
export function assertRenderPort(adapter) {
  if (typeof adapter.drawFrame !== 'function')
    throw new Error('RenderPort: missing drawFrame(state)');
}
