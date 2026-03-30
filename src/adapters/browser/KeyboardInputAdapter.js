import { VIRTUAL_H } from '../../domain/constants.js';

/**
 * Reads keyboard and mouse-wheel state and produces InputPort snapshots.
 * Arrow keys and WASD set a direction; mouse wheel accumulates an absolute Y.
 * Pressing a key clears the wheel position so keyboard takes over immediately.
 * Call read() each tick to get the current snapshot.
 */
export class KeyboardInputAdapter {
  #direction = null; // 'up' | 'down' | null
  #restartPending = false;
  #wheelY = null; // virtual-coordinate Y set by mouse wheel, null = inactive

  init() {
    window.addEventListener('keydown', (ev) => {
      switch (ev.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
        case '8': {
          this.#direction = 'up';
          this.#wheelY = null;
          break;
        }
        case 'ArrowDown':
        case 's':
        case 'S':
        case '2': {
          this.#direction = 'down';
          this.#wheelY = null;
          break;
        }
        case 'Enter': {
          this.#restartPending = true;
          break;
        }
        // No default
      }
    });
    window.addEventListener('keyup', () => {
      this.#direction = null;
    });
    window.addEventListener('wheel', (ev) => {
      // Normalise: deltaMode 1 = lines (~20px each), 0 = pixels
      const delta = ev.deltaMode === 1 ? ev.deltaY * 20 : ev.deltaY;
      this.#wheelY = Math.max(
        0,
        Math.min(VIRTUAL_H, (this.#wheelY ?? VIRTUAL_H / 2) + delta * 0.4),
      );
    });
  }

  /** @returns {import('../../ports/InputPort.js').InputSnapshot} */
  read() {
    const snap = {
      paddleDirection: this.#direction,
      paddleAbsoluteY: this.#direction === null ? this.#wheelY : null,
      restartRequested: this.#restartPending,
    };
    this.#restartPending = false; // consume
    return snap;
  }
}
