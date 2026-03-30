/**
 * Reads keyboard state and produces InputPort snapshots.
 * Call read() each tick to get the current snapshot.
 */
export class KeyboardInputAdapter {
  #direction = null; // 'up' | 'down' | null
  #restartPending = false;

  init() {
    window.addEventListener('keydown', (ev) => {
      switch (ev.key) {
        case 'ArrowUp':
        case '8': {
          this.#direction = 'up';

          break;
        }
        case 'ArrowDown':
        case '2': {
          this.#direction = 'down';

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
  }

  /** @returns {import('../../ports/InputPort.js').InputSnapshot} */
  read() {
    const snap = {
      paddleDirection: this.#direction,
      paddleAbsoluteY: null,
      restartRequested: this.#restartPending,
    };
    this.#restartPending = false; // consume
    return snap;
  }
}
