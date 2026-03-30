import { VIRTUAL_H } from '../../domain/constants.js';

/**
 * Converts touch events on the #touch-control zone into InputPort snapshots.
 * Merges with keyboard and an optional gamepad adapter so all inputs coexist.
 *
 * Priority: touch absoluteY > keyboard (keys + wheel) > gamepad
 *
 * @param {import('./KeyboardInputAdapter.js').KeyboardInputAdapter} keyboardAdapter
 * @param {import('./GamepadInputAdapter.js').GamepadInputAdapter|null} gamepadAdapter
 */
export class TouchInputAdapter {
  #keyboard;
  #gamepad;
  #absoluteY = null;

  constructor(keyboardAdapter, gamepadAdapter = null) {
    this.#keyboard = keyboardAdapter;
    this.#gamepad = gamepadAdapter;
  }

  init(zone, paddleH) {
    if (!zone) return;

    const onTouch = (ev) => {
      const touch = ev.touches[0];
      const rect = zone.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
      this.#absoluteY = relativeY * (VIRTUAL_H - paddleH);
    };

    zone.addEventListener('touchstart', onTouch, { passive: true });
    zone.addEventListener('touchmove', onTouch, { passive: true });
    zone.addEventListener(
      'touchend',
      () => {
        this.#absoluteY = null;
      },
      { passive: true },
    );
  }

  /** @returns {import('../../ports/InputPort.js').InputSnapshot} */
  read() {
    const kb = this.#keyboard.read();
    const gp = this.#gamepad?.read();
    return {
      paddleDirection: kb.paddleDirection ?? gp?.paddleDirection ?? null,
      paddleAbsoluteY: this.#absoluteY ?? kb.paddleAbsoluteY ?? null,
      restartRequested: kb.restartRequested || (gp?.restartRequested ?? false),
    };
  }
}
