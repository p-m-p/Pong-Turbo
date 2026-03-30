// Standard Gamepad API mapping (covers Xbox, PlayStation, most USB controllers)
const AXIS_LEFT_Y = 1;
const BTN_DPAD_UP = 12;
const BTN_DPAD_DOWN = 13;
const BTN_A = 0; // A / Cross
const BTN_START = 9; // Start / Options
const DEADZONE = 0.2;

/**
 * Reads gamepad state via the Web Gamepad API and produces InputPort snapshots.
 * Polls navigator.getGamepads() on each read() — no RAF needed, the game loop
 * drives polling.
 */
export class GamepadInputAdapter {
  #connected = false;

  init() {
    this.#connected = [...navigator.getGamepads()].some(Boolean);
    window.addEventListener('gamepadconnected', () => {
      this.#connected = true;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.#connected = [...navigator.getGamepads()].some(Boolean);
    });
  }

  /** @returns {import('../../ports/InputPort.js').InputSnapshot} */
  read() {
    const empty = { paddleDirection: null, paddleAbsoluteY: null, restartRequested: false };
    if (!this.#connected) return empty;

    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;

      const axisY = pad.axes[AXIS_LEFT_Y] ?? 0;
      const dpadUp = pad.buttons[BTN_DPAD_UP]?.pressed ?? false;
      const dpadDown = pad.buttons[BTN_DPAD_DOWN]?.pressed ?? false;
      const restart = (pad.buttons[BTN_A]?.pressed || pad.buttons[BTN_START]?.pressed) ?? false;

      let paddleDirection = null;
      if (axisY < -DEADZONE || dpadUp) paddleDirection = 'up';
      else if (axisY > DEADZONE || dpadDown) paddleDirection = 'down';

      if (paddleDirection !== null || restart) {
        return { paddleDirection, paddleAbsoluteY: null, restartRequested: restart };
      }
    }

    return empty;
  }
}
