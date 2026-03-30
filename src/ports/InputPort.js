/**
 * @typedef {Object} InputPort
 * @property {() => InputSnapshot} read
 *
 * @typedef {Object} InputSnapshot
 * @property {'up'|'down'|null} paddleDirection
 * @property {number|null}      paddleAbsoluteY   - touch: target Y in virtual units
 * @property {boolean}          restartRequested
 */
export function assertInputPort(adapter) {
  if (typeof adapter.read !== 'function') throw new Error('InputPort: missing read()');
}
