import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VIRTUAL_H } from '../../src/domain/constants.js';
import { KeyboardInputAdapter } from '../../src/adapters/browser/KeyboardInputAdapter.js';

let listeners;
let adapter;

beforeEach(() => {
  listeners = {};
  vi.stubGlobal('window', {
    addEventListener: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
  });
  adapter = new KeyboardInputAdapter();
  adapter.init();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fireKeydown(key) {
  for (const h of listeners['keydown'] ?? []) h({ key });
}
function fireKeyup() {
  for (const h of listeners['keyup'] ?? []) h({});
}
function fireWheel(deltaY, deltaMode = 0) {
  for (const h of listeners['wheel'] ?? []) h({ deltaY, deltaMode });
}

describe('KeyboardInputAdapter — initial state', () => {
  it('returns null direction before any input', () => {
    expect(adapter.read().paddleDirection).toBeNull();
  });

  it('returns null paddleAbsoluteY before any wheel input', () => {
    expect(adapter.read().paddleAbsoluteY).toBeNull();
  });

  it('returns false restartRequested before Enter', () => {
    expect(adapter.read().restartRequested).toBe(false);
  });
});

describe('KeyboardInputAdapter — direction keys', () => {
  it.each([['ArrowUp'], ['w'], ['W'], ['8']])('%s sets direction to up', (key) => {
    fireKeydown(key);
    expect(adapter.read().paddleDirection).toBe('up');
  });

  it.each([['ArrowDown'], ['s'], ['S'], ['2']])('%s sets direction to down', (key) => {
    fireKeydown(key);
    expect(adapter.read().paddleDirection).toBe('down');
  });

  it('keyup clears direction to null', () => {
    fireKeydown('ArrowUp');
    fireKeyup();
    expect(adapter.read().paddleDirection).toBeNull();
  });

  it('paddleAbsoluteY is null when a direction key is held', () => {
    fireKeydown('ArrowDown');
    expect(adapter.read().paddleAbsoluteY).toBeNull();
  });
});

describe('KeyboardInputAdapter — restart', () => {
  it('Enter sets restartRequested to true', () => {
    fireKeydown('Enter');
    expect(adapter.read().restartRequested).toBe(true);
  });

  it('restartRequested is consumed after one read', () => {
    fireKeydown('Enter');
    adapter.read();
    expect(adapter.read().restartRequested).toBe(false);
  });
});

describe('KeyboardInputAdapter — mouse wheel', () => {
  it('wheel event sets paddleAbsoluteY near VIRTUAL_H/2 on first use', () => {
    fireWheel(0); // zero delta — initialises at VIRTUAL_H/2
    expect(adapter.read().paddleAbsoluteY).toBe(VIRTUAL_H / 2);
  });

  it('downward wheel increases paddleAbsoluteY', () => {
    fireWheel(100);
    expect(adapter.read().paddleAbsoluteY).toBeGreaterThan(VIRTUAL_H / 2);
  });

  it('upward wheel decreases paddleAbsoluteY', () => {
    fireWheel(-100);
    expect(adapter.read().paddleAbsoluteY).toBeLessThan(VIRTUAL_H / 2);
  });

  it('paddleAbsoluteY is clamped to [0, VIRTUAL_H]', () => {
    fireWheel(1_000_000);
    expect(adapter.read().paddleAbsoluteY).toBe(VIRTUAL_H);
    fireWheel(-1_000_000);
    fireWheel(-1_000_000);
    expect(adapter.read().paddleAbsoluteY).toBe(0);
  });

  it('line deltaMode (1) is scaled to pixels', () => {
    fireWheel(1, 1); // 1 line ≈ 20px
    const y1 = adapter.read().paddleAbsoluteY;
    adapter = new KeyboardInputAdapter();
    adapter.init();
    fireWheel(20, 0); // 20 raw pixels
    const y2 = adapter.read().paddleAbsoluteY;
    expect(y1).toBeCloseTo(y2, 5);
  });

  it('pressing a key clears wheel position so keyboard takes over', () => {
    fireWheel(200);
    fireKeydown('ArrowUp');
    const snap = adapter.read();
    expect(snap.paddleDirection).toBe('up');
    expect(snap.paddleAbsoluteY).toBeNull();
  });

  it('paddleAbsoluteY is null when a direction key is active even with prior wheel', () => {
    fireWheel(50);
    fireKeydown('s');
    expect(adapter.read().paddleAbsoluteY).toBeNull();
  });
});
