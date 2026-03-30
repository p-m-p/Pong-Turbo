import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GamepadInputAdapter } from '../../src/adapters/browser/GamepadInputAdapter.js';

let windowListeners;
let gamepads;
let adapter;

function makeButton(pressed) {
  return { pressed };
}

function makePad(overrides = {}) {
  const axes = overrides.axes ?? [0, 0, 0, 0];
  const buttons = overrides.buttons ?? Array.from({ length: 14 }, () => makeButton(false));
  return { axes, buttons };
}

beforeEach(() => {
  windowListeners = {};
  gamepads = [null, null, null, null];

  vi.stubGlobal('window', {
    addEventListener: (event, handler) => {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(handler);
    },
  });
  vi.stubGlobal('navigator', {
    getGamepads: () => gamepads,
  });

  adapter = new GamepadInputAdapter();
  adapter.init();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fireGamepadConnected() {
  for (const h of windowListeners['gamepadconnected'] ?? []) h({});
}
function fireGamepadDisconnected() {
  for (const h of windowListeners['gamepaddisconnected'] ?? []) h({});
}

describe('GamepadInputAdapter — no gamepad', () => {
  it('returns empty snapshot when no gamepad connected', () => {
    const snap = adapter.read();
    expect(snap.paddleDirection).toBeNull();
    expect(snap.paddleAbsoluteY).toBeNull();
    expect(snap.restartRequested).toBe(false);
  });
});

describe('GamepadInputAdapter — left stick', () => {
  beforeEach(() => {
    gamepads[0] = makePad();
    fireGamepadConnected();
  });

  it('stick Y above deadzone returns down', () => {
    gamepads[0].axes[1] = 0.5;
    expect(adapter.read().paddleDirection).toBe('down');
  });

  it('stick Y below negative deadzone returns up', () => {
    gamepads[0].axes[1] = -0.5;
    expect(adapter.read().paddleDirection).toBe('up');
  });

  it('stick Y within deadzone returns null direction', () => {
    gamepads[0].axes[1] = 0.1;
    expect(adapter.read().paddleDirection).toBeNull();
  });

  it('always returns null paddleAbsoluteY', () => {
    gamepads[0].axes[1] = 0.9;
    expect(adapter.read().paddleAbsoluteY).toBeNull();
  });
});

describe('GamepadInputAdapter — d-pad', () => {
  beforeEach(() => {
    gamepads[0] = makePad();
    fireGamepadConnected();
  });

  it('d-pad up (button 12) returns up', () => {
    gamepads[0].buttons[12] = makeButton(true);
    expect(adapter.read().paddleDirection).toBe('up');
  });

  it('d-pad down (button 13) returns down', () => {
    gamepads[0].buttons[13] = makeButton(true);
    expect(adapter.read().paddleDirection).toBe('down');
  });
});

describe('GamepadInputAdapter — restart buttons', () => {
  beforeEach(() => {
    gamepads[0] = makePad();
    fireGamepadConnected();
  });

  it('button A (0) sets restartRequested', () => {
    gamepads[0].buttons[0] = makeButton(true);
    expect(adapter.read().restartRequested).toBe(true);
  });

  it('Start (9) sets restartRequested', () => {
    gamepads[0].buttons[9] = makeButton(true);
    expect(adapter.read().restartRequested).toBe(true);
  });
});

describe('GamepadInputAdapter — connect / disconnect', () => {
  it('gamepadconnected event enables polling', () => {
    gamepads[0] = makePad();
    gamepads[0].axes[1] = 0.9;
    fireGamepadConnected();
    expect(adapter.read().paddleDirection).toBe('down');
  });

  it('gamepaddisconnected with no remaining pads stops polling', () => {
    gamepads[0] = makePad();
    fireGamepadConnected();
    gamepads[0] = null;
    fireGamepadDisconnected();
    expect(adapter.read().paddleDirection).toBeNull();
  });

  it('gamepaddisconnected with another pad still connected keeps polling', () => {
    gamepads[0] = makePad();
    gamepads[1] = makePad();
    gamepads[1].axes[1] = -0.8;
    fireGamepadConnected();
    gamepads[0] = null;
    fireGamepadDisconnected();
    expect(adapter.read().paddleDirection).toBe('up');
  });
});
