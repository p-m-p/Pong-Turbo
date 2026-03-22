import { VIRTUAL_H } from '../../domain/constants.js';

/**
 * Converts touch events on the #touch-control zone into InputPort snapshots.
 * Merges with a secondary adapter (keyboard) so touch and keyboard can coexist.
 *
 * @param {import('./KeyboardInputAdapter.js').KeyboardInputAdapter} keyboardAdapter
 */
export class TouchInputAdapter {
  #keyboard;
  #absoluteY  = null;

  constructor(keyboardAdapter) {
    this.#keyboard = keyboardAdapter;
  }

  init(zone, paddleH) {
    if (!zone) return;

    const onTouch = (ev) => {
      const touch = ev.touches[0];
      const rect  = zone.getBoundingClientRect();
      const relY  = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
      this.#absoluteY = relY * (VIRTUAL_H - paddleH);
    };

    zone.addEventListener('touchstart', onTouch, { passive: true });
    zone.addEventListener('touchmove',  onTouch, { passive: true });
    zone.addEventListener('touchend',   () => { this.#absoluteY = null; }, { passive: true });
  }

  /** @returns {import('../../ports/InputPort.js').InputSnapshot} */
  read() {
    const base = this.#keyboard.read();
    return {
      ...base,
      paddleAbsoluteY: this.#absoluteY,
    };
  }
}
