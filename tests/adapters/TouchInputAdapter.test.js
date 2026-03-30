import { describe, it, expect, beforeEach } from 'vitest';
import { TouchInputAdapter } from '../../src/adapters/browser/TouchInputAdapter.js';

function makeKeyboardStub(snapshot = {}) {
  return {
    read: () => ({
      paddleDirection: null,
      paddleAbsoluteY: null,
      restartRequested: false,
      ...snapshot,
    }),
  };
}

function makeGamepadStub(snapshot = {}) {
  return {
    read: () => ({
      paddleDirection: null,
      paddleAbsoluteY: null,
      restartRequested: false,
      ...snapshot,
    }),
  };
}

describe('TouchInputAdapter — keyboard passthrough', () => {
  it('returns keyboard direction when no other input', () => {
    const adapter = new TouchInputAdapter(makeKeyboardStub({ paddleDirection: 'up' }));
    expect(adapter.read().paddleDirection).toBe('up');
  });

  it('returns keyboard paddleAbsoluteY when no touch active', () => {
    const adapter = new TouchInputAdapter(makeKeyboardStub({ paddleAbsoluteY: 150 }));
    expect(adapter.read().paddleAbsoluteY).toBe(150);
  });

  it('returns keyboard restartRequested', () => {
    const adapter = new TouchInputAdapter(makeKeyboardStub({ restartRequested: true }));
    expect(adapter.read().restartRequested).toBe(true);
  });
});

describe('TouchInputAdapter — gamepad fallback', () => {
  it('uses gamepad direction when keyboard returns null', () => {
    const adapter = new TouchInputAdapter(
      makeKeyboardStub({ paddleDirection: null }),
      makeGamepadStub({ paddleDirection: 'down' }),
    );
    expect(adapter.read().paddleDirection).toBe('down');
  });

  it('keyboard direction takes priority over gamepad', () => {
    const adapter = new TouchInputAdapter(
      makeKeyboardStub({ paddleDirection: 'up' }),
      makeGamepadStub({ paddleDirection: 'down' }),
    );
    expect(adapter.read().paddleDirection).toBe('up');
  });

  it('restartRequested is OR of keyboard and gamepad', () => {
    const adapter = new TouchInputAdapter(
      makeKeyboardStub({ restartRequested: false }),
      makeGamepadStub({ restartRequested: true }),
    );
    expect(adapter.read().restartRequested).toBe(true);
  });

  it('works with no gamepad adapter (null)', () => {
    const adapter = new TouchInputAdapter(makeKeyboardStub({ paddleDirection: 'down' }), null);
    expect(adapter.read().paddleDirection).toBe('down');
  });
});

describe('TouchInputAdapter — touch priority', () => {
  it('touch absoluteY overrides keyboard paddleAbsoluteY', () => {
    const adapter = new TouchInputAdapter(makeKeyboardStub({ paddleAbsoluteY: 100 }));
    // Simulate touch by triggering the internal handler via init with a mock zone
    const zoneListeners = {};
    const zone = {
      addEventListener: (ev, handler) => {
        zoneListeners[ev] = handler;
      },
      getBoundingClientRect: () => ({ top: 0, height: 400 }),
    };
    adapter.init(zone, 60);
    zoneListeners['touchstart']({ touches: [{ clientY: 200 }] });
    // touch Y = 200/400 of zone = 0.5 → (VIRTUAL_H - paddleH) * 0.5 = (400-60)*0.5 = 170
    expect(adapter.read().paddleAbsoluteY).toBeCloseTo(170);
  });

  it('touch absoluteY overrides gamepad paddleAbsoluteY', () => {
    const adapter = new TouchInputAdapter(
      makeKeyboardStub(),
      makeGamepadStub({ paddleAbsoluteY: 300 }),
    );
    const zoneListeners = {};
    const zone = {
      addEventListener: (ev, handler) => {
        zoneListeners[ev] = handler;
      },
      getBoundingClientRect: () => ({ top: 0, height: 400 }),
    };
    adapter.init(zone, 60);
    zoneListeners['touchstart']({ touches: [{ clientY: 0 }] });
    expect(adapter.read().paddleAbsoluteY).toBe(0);
  });

  it('touchend clears absoluteY so keyboard/gamepad takes over', () => {
    const adapter = new TouchInputAdapter(makeKeyboardStub({ paddleAbsoluteY: 50 }));
    const zoneListeners = {};
    const zone = {
      addEventListener: (ev, handler) => {
        zoneListeners[ev] = handler;
      },
      getBoundingClientRect: () => ({ top: 0, height: 400 }),
    };
    adapter.init(zone, 60);
    zoneListeners['touchstart']({ touches: [{ clientY: 200 }] });
    zoneListeners['touchend']();
    expect(adapter.read().paddleAbsoluteY).toBe(50); // falls back to keyboard
  });
});
