/**
 * Reads keyboard state and produces InputPort snapshots.
 * Call read() each tick to get the current snapshot.
 */
export class KeyboardInputAdapter {
  #direction      = null;  // 'up' | 'down' | null
  #restartPending = false;

  init() {
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowUp' || ev.key === '8') {
        this.#direction = 'up';
      } else if (ev.key === 'ArrowDown' || ev.key === '2') {
        this.#direction = 'down';
      } else if (ev.key === 'Enter') {
        this.#restartPending = true;
      }
    });
    window.addEventListener('keyup', () => {
      this.#direction = null;
    });
  }

  /** @returns {import('../../ports/InputPort.js').InputSnapshot} */
  read() {
    const snap = {
      paddleDirection:  this.#direction,
      paddleAbsoluteY:  null,
      restartRequested: this.#restartPending,
    };
    this.#restartPending = false; // consume
    return snap;
  }
}
